"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = CounterPage;
const jsx_runtime_1 = require("preact/jsx-runtime");
const hooks_1 = require("preact/hooks");
// Image and css modules work out of the box!!
const local_module_css_1 = __importDefault(require("./local.module.css"));
function CounterPage() {
    const [count, setCount] = (0, hooks_1.useState)(0);
    return (0, jsx_runtime_1.jsxs)("main", { children: [(0, jsx_runtime_1.jsxs)("h1", { className: local_module_css_1.default.bruh, children: ["Current count: ", count] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("button", { onClick: () => setCount(count + 1), children: "Increase" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => setCount(count - 1), children: "Decrease" })] })] });
}
