// graphify — OpenCode V2 plugin (knowledge-graph nudge).
//
// Re-implementation of graphify's original V1 "tool.execute.before" reminder,
// migrated to the canonical V2 plugin shape.
//
// The V2 Plugin interface is the plain object { id, setup } — Plugin.define is
// identity (it just returns its argument) — so this file needs NO runtime import
// of "@opencode/plugin". That import is what broke the earlier attempts: it is
// not resolvable from a local plugin's location, so Bun's loader failed with
// "Cannot find package '@opencode/plugin'". Writing the object directly avoids
// the import entirely while producing an identical, valid plugin.
//
// Auto-loaded from .opencode/plugins/ (no opencode.json entry is needed).
export default {
  id: "graphify",
  async setup(ctx) {
    let reminded = false;
    const reminder =
      "[graphify] A local knowledge graph exists at graphify-out/ " +
      "(graph.json, GRAPH_REPORT.md). For focused codebase questions, prefer " +
      "the graph over grepping raw files: 'graphify query \"<question>\"' for a " +
      "scoped subgraph, 'graphify path \"A\" \"B\"' for a relationship, or " +
      "'graphify explain \"<concept>\"' for one concept, or the /graphify command. " +
      "Use GRAPH_REPORT.md only for broad architecture review.";

    await ctx.session.hook("context", (event) => {
      if (!reminded) {
        reminded = true;
        event.system.push({ type: "text", text: reminder });
      }
    });
  },
};
