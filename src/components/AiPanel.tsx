import { useEffect, useMemo, useState } from 'preact/hooks';
import { Check, LoaderCircle, ShieldCheck, Sparkles, X } from 'lucide-preact';
import { AI_TASK_LABELS, AiError, aiReview, preparePayload, runAi, type AiPayload, type AiResult, type AiTask } from '../lib/ai';
import { addItem, updateItem } from '../lib/repo';
import { fromInputs, formatDue } from '../lib/dates';
import { appendMarkdown } from '../lib/notes';
import { toast } from '../lib/toast';
import type { Item } from '../lib/types';
import { Modal } from './Modal';

/** Adds text to the end of the item's description. */
type AppendBody = (markdown: string) => void | Promise<void>;

interface Props {
  task: AiTask;
  payload: AiPayload;
  /** The item the result applies to; absent when working on text from the capture box. */
  item?: Item;
  /**
   * Set by an open editor, which keeps its own copy of the description. Writing
   * to the database behind its back would show stale text and be overwritten
   * by the editor's next save.
   */
  onAppendBody?: AppendBody;
  /** Space for tasks created from the result. */
  spaceId?: string | null;
  onClose: () => void;
  onTasksCreated?: (n: number) => void;
}

type Step = { name: 'review' } | { name: 'loading' } | { name: 'error'; message: string } | { name: 'result'; result: AiResult };

export function AiPanel({ task, payload, item, onAppendBody, spaceId = null, onClose, onTasksCreated }: Props) {
  const prepared = useMemo(() => preparePayload(payload), [payload]);
  const [step, setStep] = useState<Step>(aiReview.value ? { name: 'review' } : { name: 'loading' });
  const append: AppendBody | undefined = item && (onAppendBody ?? ((md) => updateItem(item.id, { body: appendMarkdown(item.body, md) })));

  async function send() {
    setStep({ name: 'loading' });
    try {
      setStep({ name: 'result', result: await runAi(task, prepared.input) });
    } catch (e) {
      setStep({ name: 'error', message: e instanceof AiError ? e.message : 'Something went wrong.' });
    }
  }

  useEffect(() => {
    if (!aiReview.value) void send();
  }, []);

  return (
    <Modal title={AI_TASK_LABELS[task]} onClose={onClose} size="lg">
      {step.name === 'review' && (
        <div class="space-y-3 pt-1">
          <p class="text-sm text-muted flex gap-2">
            <ShieldCheck size={18} class="text-accent shrink-0" />
            <span>
              This exact text goes to Groq’s AI to answer, then comes back here. Cove doesn’t keep a copy on its server.
              {prepared.redactions > 0 && ` ${prepared.redactions} personal detail${prepared.redactions === 1 ? ' was' : 's were'} hidden.`}
              {prepared.truncated && ' Only the first 8,000 characters are sent.'}
            </span>
          </p>
          <pre class="text-xs bg-surface2 border border-border rounded-lg p-3 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono">
            {prepared.input.title && `Title: ${prepared.input.title}\n\n`}
            {prepared.input.text || '(no text)'}
          </pre>
          <div class="flex justify-end gap-2">
            <button class="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button class="btn btn-primary" onClick={send}>
              <Sparkles size={16} /> Send
            </button>
          </div>
        </div>
      )}

      {step.name === 'loading' && (
        <div class="flex items-center gap-3 py-10 justify-center text-muted" role="status">
          <LoaderCircle size={20} class="animate-spin" /> Thinking…
        </div>
      )}

      {step.name === 'error' && (
        <div class="space-y-4 pt-1">
          <p class="text-sm text-danger">{step.message}</p>
          <div class="flex justify-end gap-2">
            <button class="btn btn-ghost" onClick={onClose}>Close</button>
            <button class="btn" onClick={send}>Try again</button>
          </div>
        </div>
      )}

      {step.name === 'result' && (
        <div class="pt-1">
          <p class="text-xs text-subtle mb-3">AI can be wrong. Check before you rely on it.</p>
          <Result result={step.result} item={item} append={append} spaceId={spaceId} onClose={onClose} onTasksCreated={onTasksCreated} />
        </div>
      )}
    </Modal>
  );
}

function Result({ result, item, append, spaceId, onClose, onTasksCreated }: { result: AiResult; item?: Item; append?: AppendBody; spaceId: string | null; onClose: () => void; onTasksCreated?: (n: number) => void }) {
  switch (result.task) {
    case 'summarize':
      return <SummaryResult result={result} append={append} onClose={onClose} />;
    case 'tags':
      return <TagsResult tags={result.tags} item={item} onClose={onClose} />;
    case 'extract_tasks':
      return <TasksResult tasks={result.tasks} spaceId={item?.spaceId ?? spaceId} onClose={onClose} onCreated={onTasksCreated} />;
    case 'quiz':
      return <QuizResult questions={result.questions} append={append} onClose={onClose} />;
  }
}

function SummaryResult({ result, append, onClose }: { result: Extract<AiResult, { task: 'summarize' }>; append?: AppendBody; onClose: () => void }) {
  const markdown = `## Summary\n\n${result.summary}${result.keyPoints.length ? '\n\n' + result.keyPoints.map((p) => `- ${p}`).join('\n') : ''}`;
  return (
    <div class="space-y-4">
      <div class="space-y-2">
        <p class="leading-relaxed">{result.summary}</p>
        {result.keyPoints.length > 0 && (
          <ul class="list-disc pl-5 space-y-1 text-sm text-muted">
            {result.keyPoints.map((p) => <li key={p}>{p}</li>)}
          </ul>
        )}
      </div>
      <div class="flex flex-wrap justify-end gap-2">
        <button
          class="btn"
          onClick={async () => {
            await navigator.clipboard?.writeText(markdown).catch(() => {});
            toast('Copied');
          }}
        >
          Copy
        </button>
        {append && (
          <button
            class="btn btn-primary"
            onClick={async () => {
              await append(markdown);
              toast('Added to the description');
              onClose();
            }}
          >
            Add to description
          </button>
        )}
      </div>
    </div>
  );
}

function TagsResult({ tags, item, onClose }: { tags: string[]; item?: Item; onClose: () => void }) {
  const fresh = tags.filter((t) => !item?.tags.includes(t));
  const [picked, setPicked] = useState<Set<string>>(new Set(fresh));
  if (!fresh.length) {
    return <p class="text-sm text-muted">No new tags to suggest; the item already has the right ones.</p>;
  }
  return (
    <div class="space-y-4">
      <div class="flex flex-wrap gap-2">
        {fresh.map((t) => {
          const on = picked.has(t);
          return (
            <button
              key={t}
              class={`chip text-sm py-1 px-3 ${on ? 'chip-accent' : ''}`}
              aria-pressed={on}
              onClick={() => {
                const next = new Set(picked);
                on ? next.delete(t) : next.add(t);
                setPicked(next);
              }}
            >
              {on && <Check size={12} />}#{t}
            </button>
          );
        })}
      </div>
      {item && (
        <div class="flex justify-end">
          <button
            class="btn btn-primary"
            disabled={!picked.size}
            onClick={async () => {
              await updateItem(item.id, { tags: [...item.tags, ...picked] });
              toast(`Added ${picked.size} tag${picked.size === 1 ? '' : 's'}`);
              onClose();
            }}
          >
            Add selected tags
          </button>
        </div>
      )}
    </div>
  );
}

function TasksResult({ tasks, spaceId, onClose, onCreated }: { tasks: Extract<AiResult, { task: 'extract_tasks' }>['tasks']; spaceId: string | null; onClose: () => void; onCreated?: (n: number) => void }) {
  const [picked, setPicked] = useState<Set<number>>(new Set(tasks.map((_, i) => i)));
  const [titles, setTitles] = useState(tasks.map((t) => t.title));
  if (!tasks.length) return <p class="text-sm text-muted">No tasks or deadlines found in this text.</p>;

  const dueOf = (t: (typeof tasks)[number]) => (t.due ? fromInputs(t.due, t.time ?? '') : null);

  async function create() {
    const chosen = tasks.map((t, i) => ({ t, i })).filter(({ i }) => picked.has(i));
    for (const { t, i } of chosen) {
      const due = dueOf(t);
      await addItem({ title: titles[i].trim() || t.title, status: 'todo', due, dueHasTime: !!(due && t.time), spaceId });
    }
    toast(`Created ${chosen.length} task${chosen.length === 1 ? '' : 's'}`);
    onCreated?.(chosen.length);
    onClose();
  }

  return (
    <div class="space-y-4">
      <ul class="space-y-1">
        {tasks.map((t, i) => {
          const due = dueOf(t);
          return (
            <li key={i} class="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-surface2">
              <input
                type="checkbox"
                class="w-4 h-4 accent-[var(--c-accent)] shrink-0"
                checked={picked.has(i)}
                aria-label={`Create ${t.title}`}
                onChange={() => {
                  const next = new Set(picked);
                  next.has(i) ? next.delete(i) : next.add(i);
                  setPicked(next);
                }}
              />
              <input
                class="flex-1 bg-transparent outline-none text-sm"
                value={titles[i]}
                onInput={(e) => setTitles(titles.map((x, j) => (j === i ? e.currentTarget.value : x)))}
                aria-label="Task title"
              />
              <span class="text-xs text-subtle shrink-0">{due !== null ? formatDue(due, !!t.time) : 'No date'}</span>
            </li>
          );
        })}
      </ul>
      <div class="flex justify-end">
        <button class="btn btn-primary" disabled={!picked.size} onClick={create}>
          Create {picked.size} task{picked.size === 1 ? '' : 's'}
        </button>
      </div>
    </div>
  );
}

function QuizResult({ questions, append, onClose }: { questions: Extract<AiResult, { task: 'quiz' }>['questions']; append?: AppendBody; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<(number | null)[]>(questions.map(() => null));
  const done = index >= questions.length;
  const score = chosen.filter((c, i) => c === questions[i].answer).length;

  const markdown =
    '## Practice quiz\n\n' +
    questions
      .map((q, i) => `${i + 1}. ${q.question}\n${q.choices.map((c, j) => `   ${'ABCD'[j]}. ${c}`).join('\n')}\n   **Answer:** ${'ABCD'[q.answer]}. ${q.explanation}`)
      .join('\n\n');

  if (done) {
    return (
      <div class="space-y-4 text-center py-4">
        <p class="font-display text-3xl font-medium">
          {score}/{questions.length}
        </p>
        <p class="text-muted">{score === questions.length ? 'Perfect. You know this.' : score >= questions.length / 2 ? 'Good work. Review the ones you missed.' : 'Worth another read before the exam.'}</p>
        <div class="flex flex-wrap justify-center gap-2">
          <button class="btn" onClick={() => { setChosen(questions.map(() => null)); setIndex(0); }}>Retake</button>
          {append && (
            <button
              class="btn btn-primary"
              onClick={async () => {
                await append(markdown);
                toast('Quiz saved to the description');
                onClose();
              }}
            >
              Save quiz to notes
            </button>
          )}
        </div>
      </div>
    );
  }

  const q = questions[index];
  const answer = chosen[index];
  return (
    <div class="space-y-4">
      <p class="text-xs text-subtle">
        Question {index + 1} of {questions.length}
      </p>
      <p class="font-medium leading-snug">{q.question}</p>
      <div class="space-y-2">
        {q.choices.map((c, j) => {
          const isRight = answer !== null && j === q.answer;
          const isWrongPick = answer === j && j !== q.answer;
          return (
            <button
              key={j}
              disabled={answer !== null}
              class={`w-full text-left rounded-xl border px-3 py-2.5 text-sm flex gap-3 ${
                isRight ? 'border-accent bg-accent-fill' : isWrongPick ? 'border-danger bg-danger-fill' : 'border-border hover:bg-surface2'
              }`}
              onClick={() => setChosen(chosen.map((x, k) => (k === index ? j : x)))}
            >
              <span class="font-semibold text-subtle">{'ABCD'[j]}</span>
              <span class="flex-1">{c}</span>
              {isRight && <Check size={16} class="text-accent" />}
              {isWrongPick && <X size={16} class="text-danger" />}
            </button>
          );
        })}
      </div>
      {answer !== null && (
        <>
          {q.explanation && <p class="text-sm text-muted">{q.explanation}</p>}
          <div class="flex justify-end">
            <button class="btn btn-primary" onClick={() => setIndex(index + 1)}>
              {index + 1 === questions.length ? 'See score' : 'Next'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
