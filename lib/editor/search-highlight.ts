import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";

export interface SearchConfig {
  query: string;
  regex?: boolean;
  caseSensitive?: boolean;
  /** Index of the match that receives the stronger highlight. -1 = none. */
  activeIndex?: number;
}

export interface SearchMatch {
  from: number;
  to: number;
}

interface SearchPluginState {
  config: SearchConfig;
  decorations: DecorationSet;
}

export const searchHighlightKey = new PluginKey<SearchPluginState>("inkwellSearchHighlight");

export const EMPTY_MATCH_STYLE = "background: rgba(200,129,74,0.28); border-radius: 2px;";
export const ACTIVE_MATCH_STYLE = "background: #c8814a; color: #1b1611; border-radius: 2px;";

function buildRegExp(config: SearchConfig): RegExp | null {
  const query = config.query;
  if (!query) return null;
  try {
    if (config.regex) {
      return new RegExp(query, `g${config.caseSensitive ? "" : "i"}`);
    }
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(escaped, `g${config.caseSensitive ? "" : "i"}`);
  } catch {
    return null;
  }
}

/** Scan a ProseMirror document for every text match, in document order. */
export function findSearchMatches(doc: PMNode, config: SearchConfig): SearchMatch[] {
  const re = buildRegExp(config);
  if (!re) return [];
  const matches: SearchMatch[] = [];
  let capped = false;
  doc.descendants((node, pos) => {
    if (capped) return false;
    if (!node.isText || !node.text) return;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(node.text))) {
      if (!m[0].length) {
        re.lastIndex += 1;
        continue;
      }
      matches.push({ from: pos + m.index, to: pos + m.index + m[0].length });
      if (matches.length >= 5000) {
        capped = true;
        return false;
      }
    }
  });
  return matches;
}

function buildDecorations(doc: PMNode, config: SearchConfig): DecorationSet {
  if (!config.query) return DecorationSet.empty;
  const matches = findSearchMatches(doc, config);
  if (!matches.length) return DecorationSet.empty;
  const active = typeof config.activeIndex === "number" ? config.activeIndex : -1;
  const decorations = matches.map((match, index) =>
    Decoration.inline(match.from, match.to, {
      class: index === active ? "ink-search-match is-active" : "ink-search-match",
      style: index === active ? ACTIVE_MATCH_STYLE : EMPTY_MATCH_STYLE,
      "data-search-match": String(index),
    }),
  );
  return DecorationSet.create(doc, decorations);
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    searchHighlight: {
      setSearchHighlight: (config: SearchConfig) => ReturnType;
      clearSearchHighlight: () => ReturnType;
    };
  }
}

export const SearchHighlight = Extension.create({
  name: "searchHighlight",

  addCommands() {
    return {
      setSearchHighlight:
        (config) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(searchHighlightKey, { query: config.query ?? "", regex: !!config.regex, caseSensitive: !!config.caseSensitive, activeIndex: config.activeIndex ?? -1 });
            tr.setMeta("addToHistory", false);
          }
          return true;
        },
      clearSearchHighlight:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(searchHighlightKey, { query: "", regex: false, caseSensitive: false, activeIndex: -1 });
            tr.setMeta("addToHistory", false);
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchPluginState>({
        key: searchHighlightKey,
        state: {
          init: () => ({
            config: { query: "", activeIndex: -1 },
            decorations: DecorationSet.empty,
          }),
          apply: (tr, previous) => {
            const meta = tr.getMeta(searchHighlightKey) as SearchConfig | undefined;
            const config = meta ?? previous.config;
            if (meta || tr.docChanged) {
              return { config, decorations: buildDecorations(tr.doc, config) };
            }
            return previous;
          },
        },
        props: {
          decorations(state) {
            return searchHighlightKey.getState(state)?.decorations ?? null;
          },
        },
      }),
    ];
  },
});

/** Non-extension helper: scroll the active match into view in an editor view. */
export function scrollToMatch(view: EditorView, match: SearchMatch) {
  const coords = view.coordsAtPos(match.from);
  const scroller = view.dom.closest<HTMLElement>("[data-editor-scroll]") ?? document.scrollingElement;
  if (!scroller) return;
  const box = scroller === document.scrollingElement ? { top: 0, height: window.innerHeight } : scroller.getBoundingClientRect();
  const target = coords.top - box.top - box.height * 0.4;
  if (scroller === document.scrollingElement) {
    window.scrollBy({ top: target, behavior: "smooth" });
  } else {
    scroller.scrollBy({ top: target, behavior: "smooth" });
  }
}
