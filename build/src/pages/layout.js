"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Layout;
const jsx_runtime_1 = require("preact/jsx-runtime");
require("../global.css");
function Layout({ children }) {
    return (0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, { children: children });
}
