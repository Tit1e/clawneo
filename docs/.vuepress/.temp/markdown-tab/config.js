import { CodeTabs } from "/Users/tit1e/Public/Projects/GitHub/miniclaw/node_modules/@vuepress/plugin-markdown-tab/dist/client/components/CodeTabs.js";
import { Tabs } from "/Users/tit1e/Public/Projects/GitHub/miniclaw/node_modules/@vuepress/plugin-markdown-tab/dist/client/components/Tabs.js";
import "/Users/tit1e/Public/Projects/GitHub/miniclaw/node_modules/@vuepress/plugin-markdown-tab/dist/client/styles/vars.css";

export default {
  enhance: ({ app }) => {
    app.component("CodeTabs", CodeTabs);
    app.component("Tabs", Tabs);
  },
};
