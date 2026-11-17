// markDX's own Marp themes. Original designs: system fonts only, so a deck
// looks the same offline, and no asset is loaded from the network.

/** Warm paper, ink text, vermilion accent. */
export const PAPER_THEME = `/* @theme paper */
@import 'default';

section {
  background: #f6f1e7;
  color: #14141f;
  font-family: 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif;
  font-size: 30px;
  padding: 72px 88px;
}
h1, h2, h3, h4 {
  color: #14141f;
  font-weight: 700;
  letter-spacing: -0.01em;
}
h1 {
  font-size: 1.9em;
  border-bottom: 4px solid #ff5a36;
  padding-bottom: 0.15em;
  display: inline-block;
}
a { color: #b8381c; }
strong { color: #b8381c; }
code {
  background: #e9e1d0;
  color: #14141f;
  border-radius: 4px;
}
pre { background: #e9e1d0; }
blockquote {
  border-left: 6px solid #ff5a36;
  color: #3a3a4a;
}
section::after { color: #6b6658; font-size: 0.6em; }
`

/** Near-black ink, cream text, vermilion accent. */
export const INK_THEME = `/* @theme ink */
@import 'default';

section {
  background: #14141f;
  color: #f6f1e7;
  font-family: -apple-system, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
  font-size: 30px;
  padding: 72px 88px;
}
h1, h2, h3, h4 {
  color: #f6f1e7;
  font-weight: 700;
  letter-spacing: -0.02em;
}
h1 {
  font-size: 1.9em;
  border-bottom: 4px solid #ff5a36;
  padding-bottom: 0.15em;
  display: inline-block;
}
a { color: #ff8a6b; }
strong { color: #ff8a6b; }
code {
  background: #26263a;
  color: #f6f1e7;
  border-radius: 4px;
}
pre { background: #26263a; }
blockquote {
  border-left: 6px solid #ff5a36;
  color: #d8d2c4;
}
section::after { color: #a8a294; font-size: 0.6em; }
`
