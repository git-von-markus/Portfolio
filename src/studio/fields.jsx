import { useEffect, useRef, useState } from 'preact/hooks';
import { marked } from 'marked';
import { previewUrl } from './state.js';
import { createStore } from './mini-store.js';

let fieldId = 0;
const useId = () => useRef(`f${++fieldId}`).current;

export function Field({ label, hint, children, id }) {
  return (
    <div class="field">
      <label for={id}>{label}</label>
      {children}
      {hint && <p class="hint">{hint}</p>}
    </div>
  );
}

export function Text({ label, hint, value, onInput, placeholder, type = 'text', list, maxLength }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} id={id}>
      <input id={id} type={type} value={value ?? ''} placeholder={placeholder} list={list} maxLength={maxLength}
        onInput={(e) => onInput(e.currentTarget.value)} />
    </Field>
  );
}

export function Area({ label, hint, value, onInput, rows = 3, placeholder, counter }) {
  const id = useId();
  const len = (value ?? '').length;
  return (
    <Field label={label} hint={hint} id={id}>
      <textarea id={id} rows={rows} value={value ?? ''} placeholder={placeholder}
        onInput={(e) => onInput(e.currentTarget.value)} />
      {counter && <span class={`counter ${len > counter ? 'over' : ''}`}>{len} / {counter} Zeichen empfohlen</span>}
    </Field>
  );
}

export function Select({ label, hint, value, onChange, options }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} id={id}>
      <select id={id} value={value} onChange={(e) => onChange(e.currentTarget.value)}>
        {options.map((o) => <option value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}

export function Toggle({ label, hint, checked, onChange }) {
  const id = useId();
  return (
    <div class="toggle">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.currentTarget.checked)} />
      <label for={id}>{label}{hint && <span class="hint">{hint}</span>}</label>
    </div>
  );
}

export function TagInput({ label, hint, value = [], onChange, placeholder = 'Eingeben und Enter drücken' }) {
  const id = useId();
  const [draft, setDraft] = useState('');
  const add = () => {
    const parts = draft.split(',').map((t) => t.trim()).filter(Boolean).filter((t) => !value.includes(t));
    if (parts.length) onChange([...value, ...parts]);
    setDraft('');
  };
  return (
    <Field label={label} hint={hint} id={id}>
      <div class="tags">
        {value.map((t, i) => (
          <span class="tag">
            {t}
            <button type="button" aria-label={`${t} entfernen`} onClick={() => onChange(value.filter((_, j) => j !== i))}>×</button>
          </span>
        ))}
        <input id={id} value={draft} placeholder={value.length ? '' : placeholder}
          onInput={(e) => setDraft(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
            if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={add} />
      </div>
    </Field>
  );
}

export function MarkdownField({ label, hint, value, onInput, rows = 12 }) {
  const id = useId();
  const [tab, setTab] = useState('write');
  const ref = useRef(null);

  const wrap = (before, after = before, placeholder = 'Text') => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b, value: v } = el;
    const sel = v.slice(a, b) || placeholder;
    const next = v.slice(0, a) + before + sel + after + v.slice(b);
    onInput(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + before.length, a + before.length + sel.length); });
  };
  const linePrefix = (prefix) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: a, value: v } = el;
    const start = v.lastIndexOf('\n', a - 1) + 1;
    onInput(v.slice(0, start) + prefix + v.slice(start));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + prefix.length, a + prefix.length); });
  };

  return (
    <Field label={label} hint={hint} id={id}>
      <div class="md">
        <div class="md-bar">
          <div class="md-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'write'} onClick={() => setTab('write')}>Schreiben</button>
            <button type="button" role="tab" aria-selected={tab === 'preview'} onClick={() => setTab('preview')}>Vorschau</button>
          </div>
          {tab === 'write' && (
            <div class="md-tools">
              <button type="button" title="Zwischenüberschrift" onClick={() => linePrefix('## ')}>Überschrift</button>
              <button type="button" title="Fett" onClick={() => wrap('**')}><b>F</b></button>
              <button type="button" title="Kursiv" onClick={() => wrap('*')}><i>K</i></button>
              <button type="button" title="Liste" onClick={() => linePrefix('- ')}>Liste</button>
              <button type="button" title="Link" onClick={() => wrap('[', '](https://)', 'Linktext')}>Link</button>
            </div>
          )}
        </div>
        {tab === 'write'
          ? <textarea ref={ref} id={id} rows={rows} value={value ?? ''} onInput={(e) => onInput(e.currentTarget.value)} />
          : <div class="md-preview prose" dangerouslySetInnerHTML={{ __html: marked.parse(value || '*Noch kein Text.*') }} />}
      </div>
    </Field>
  );
}

export function Preview({ path, alt = '', class: cls = 'thumb' }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let live = true;
    setUrl('');
    Promise.resolve(previewUrl(path)).then((u) => live && setUrl(u || ''));
    return () => { live = false; };
  }, [path]);
  if (!path) return <div class={`${cls} empty`} aria-hidden="true" />;
  return url ? <img class={cls} src={url} alt={alt} /> : <div class={`${cls} loading`} aria-hidden="true" />;
}

export function MoveButtons({ index, length, onMove, onRemove, removeLabel = 'Entfernen' }) {
  return (
    <div class="move">
      <button type="button" class="icon" aria-label="Nach oben" disabled={index === 0} onClick={() => onMove(index, index - 1)}>↑</button>
      <button type="button" class="icon" aria-label="Nach unten" disabled={index === length - 1} onClick={() => onMove(index, index + 1)}>↓</button>
      {onRemove && <button type="button" class="icon danger" aria-label={removeLabel} title={removeLabel} onClick={() => onRemove(index)}>×</button>}
    </div>
  );
}

export function move(list, from, to) {
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

/* ---------- Bestaetigungsdialog ---------- */
const confirmStore = createStore(null);

export function confirmDialog(opts) {
  return new Promise((resolve) => confirmStore.set({ ...opts, resolve }));
}

export function ConfirmHost() {
  const [state, setState] = useState(null);
  const ref = useRef(null);
  useEffect(() => confirmStore.subscribe(setState), []);
  useEffect(() => {
    if (state && ref.current && !ref.current.open) ref.current.showModal();
  }, [state]);
  const close = (v) => { state?.resolve(v); ref.current?.close(); confirmStore.set(null); };
  return (
    <dialog ref={ref} class="confirm" onCancel={(e) => { e.preventDefault(); close(false); }}>
      {state && (
        <form method="dialog" onSubmit={(e) => { e.preventDefault(); close(true); }}>
          <h2>{state.title}</h2>
          {state.text && <p>{state.text}</p>}
          <div class="actions">
            <button type="button" class="btn ghost" onClick={() => close(false)}>Abbrechen</button>
            <button type="submit" class={`btn ${state.danger ? 'danger' : ''}`} autofocus>{state.confirmLabel ?? 'OK'}</button>
          </div>
        </form>
      )}
    </dialog>
  );
}
