export type ProposalInput = {
  title: string;
  summary: string;
};

export function validateProposalInput(input: ProposalInput) {
  const errors: string[] = [];

  if (!input.title.trim()) {
    errors.push("Title is required.");
  }

  if (!input.summary.trim()) {
    errors.push("Summary is required.");
  }

  return {
    success: errors.length === 0,
    errors,
  };
}
