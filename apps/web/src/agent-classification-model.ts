import type { AgentClassification, SessionSummary } from "@pacium/contracts";

export function classificationSourceLabel(
  source: AgentClassification["source"],
): string {
  switch (source) {
    case "launch_preset":
      return "Launch preset";
    case "process_observed":
      return "Process observed";
    case "human_labelled":
      return "Human labelled";
  }
}

export function classificationConfidenceLabel(
  confidence: AgentClassification["confidence"],
): string {
  switch (confidence) {
    case "confirmed":
      return "Confirmed";
    case "high":
      return "High confidence";
    case "medium":
      return "Medium confidence";
    case "low":
      return "Low confidence";
  }
}

export function sessionAccessibleName(session: SessionSummary): string {
  return `${session.displayName}, ${session.agentClassification.label}, process ${session.processState}`;
}
