import { Text } from '@/components/ui/text';
import { emailErrorText } from '@/lib/emailApiErrors';

export type ActionFeedbackState = {
  tone: 'error' | 'success';
  text: string;
};

type Translate = (key: string) => string;

export function feedbackFromError(t: Translate, error: unknown): ActionFeedbackState {
  return { tone: 'error', text: emailErrorText(t, error) };
}

/** Webhook and other callers that already have a fallback sentence. */
export function feedbackFromThrown(error: unknown, fallback: string): ActionFeedbackState {
  const text = error instanceof Error && error.message ? error.message : fallback;
  return { tone: 'error', text };
}

/** Result of one button, rendered directly under that action. */
export function ActionFeedback({ feedback }: { feedback: ActionFeedbackState | null }) {
  if (!feedback) return null;
  return (
    <Text
      className={
        feedback.tone === 'error' ? 'font-mono text-sm text-destructive' : 'font-mono text-sm'
      }
    >
      {feedback.text}
    </Text>
  );
}
