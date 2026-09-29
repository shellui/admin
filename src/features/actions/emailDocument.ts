/** TipTap / react.email JSON document (JSONContent-compatible). */
export type ActionEmailDocument = {
  type: string;
  content?: ActionEmailDocument[];
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
  [key: string]: unknown;
};
