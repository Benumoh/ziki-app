/**
 * #site-glance: the window event that puts text in the idea box (components/idea-chat.tsx) for the person to edit
 * and send, e.g. "Post as idea" on a finding from the quick look at their site. `detail` is the text.
 */
export const FILL_IDEA_EVENT = "ziki:fill-idea";

export function fillIdeaBox(text: string): void {
  window.dispatchEvent(new CustomEvent<string>(FILL_IDEA_EVENT, { detail: text }));
}
