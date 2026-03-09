export const redirects = JSON.parse("{}")

export const routes = Object.fromEntries([
  ["/", { loader: () => import(/* webpackChunkName: "index.html" */"/Users/tit1e/Public/Projects/GitHub/miniclaw/docs/.vuepress/.temp/pages/index.html.js"), meta: {"title":""} }],
  ["/architecture.html", { loader: () => import(/* webpackChunkName: "architecture.html" */"/Users/tit1e/Public/Projects/GitHub/miniclaw/docs/.vuepress/.temp/pages/architecture.html.js"), meta: {"title":"Architecture Overview"} }],
  ["/guide/quick-start.html", { loader: () => import(/* webpackChunkName: "guide_quick-start.html" */"/Users/tit1e/Public/Projects/GitHub/miniclaw/docs/.vuepress/.temp/pages/guide/quick-start.html.js"), meta: {"title":"Quick Start"} }],
  ["/reference/commands.html", { loader: () => import(/* webpackChunkName: "reference_commands.html" */"/Users/tit1e/Public/Projects/GitHub/miniclaw/docs/.vuepress/.temp/pages/reference/commands.html.js"), meta: {"title":"Command Reference"} }],
  ["/404.html", { loader: () => import(/* webpackChunkName: "404.html" */"/Users/tit1e/Public/Projects/GitHub/miniclaw/docs/.vuepress/.temp/pages/404.html.js"), meta: {"title":""} }],
]);
