'use client';
import { useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useT } from '@/lib/i18n/client';
import { locale } from '@/lib/i18n/langs';

export type Msg = { id: number; sender_id: string; body: string; created_at: string };

// Plain and calm: no typing indicators, no read receipts, no streaks. New messages arrive every few seconds while the page is open.
export function ChatBox({ me, partner, initial, canSend, reason }: { me: string; partner: string; initial: Msg[]; canSend: boolean; reason: string }) {
  const { lang, t } = useT(); const sb = supabaseBrowser();
  const [msgs, setMsgs] = useState<Msg[]>(initial); const [text, setText] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [note, setNote] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const last = msgs.length ? msgs[msgs.length - 1].id : 0;

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs.length]);
  useEffect(() => {
    const tick = async () => {
      if (document.hidden) return;
      const { data } = await sb.from('messages').select('id, sender_id, body, created_at')
        .or(`and(sender_id.eq.${me},recipient_id.eq.${partner}),and(sender_id.eq.${partner},recipient_id.eq.${me})`).gt('id', last).order('id');
      if (data?.length) {
        setMsgs((m) => [...m, ...(data as Msg[]).filter((x) => !m.some((y) => y.id === x.id))]);
        if ((data as Msg[]).some((x) => x.sender_id === partner)) sb.rpc('mark_read', { p_from: partner });
      }
    };
    const id = setInterval(tick, 4000);
    return () => clearInterval(id);
  }, [last, me, partner, sb]);

  async function send() {
    const body = text.trim(); if (!body || busy) return;
    setBusy(true); setErr('');
    const { data, error } = await sb.rpc('send_message', { p_to: partner, p_body: body });
    setBusy(false);
    if (error) { setErr(/slow_down/.test(error.message) ? t('msg.slow') : /messages_off/.test(error.message) ? t('msg.off') : /not_friends/.test(error.message) ? t('msg.notFriends') : t('sign.errOther')); return; }
    setMsgs((m) => [...m, { id: Number(data), sender_id: me, body, created_at: new Date().toISOString() }]); setText('');
  }
  async function unsend(id: number) { const { error } = await sb.from('messages').delete().eq('id', id); if (!error) setMsgs((m) => m.filter((x) => x.id !== id)); }
  async function report(id: number) { const { error } = await sb.rpc('report_message', { p_message: id, p_reason: 'reported from chat' }); setNote(error ? t('sign.errOther') : t('msg.reported')); }
  const time = (d: string) => new Date(d).toLocaleString(locale(lang), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <div className="chat" aria-live="polite">
        {msgs.map((m) => { const mine = m.sender_id === me; return (
          <div key={m.id} className={`bubble ${mine ? 'mine' : ''}`}>{m.body}
            <span className="when">{time(m.created_at)}{mine ? <button onClick={() => unsend(m.id)}>{t('msg.unsend')}</button> : <button onClick={() => report(m.id)}>{t('msg.report')}</button>}</span></div>); })}
        <div ref={end} />
      </div>
      {note && <p className="note" role="status" style={{ margin: 0 }}>{note}</p>}
      {canSend ? (
        <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <textarea rows={1} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('msg.ph')} aria-label={t('msg.ph')}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <button className="btn primary" disabled={busy || !text.trim()}>{t('msg.send')}</button>
        </form>
      ) : <p className="note" style={{ margin: 0 }}>{reason}</p>}
      {err && <p className="error" style={{ margin: 0 }}>{err}</p>}
    </>
  );
}
