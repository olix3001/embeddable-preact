import { jsxs as _jsxs, jsx as _jsx } from "preact/jsx-runtime";
import { useState } from 'preact/hooks';
// Image and css modules work out of the box!!
import local from './local.module.css';
export default function CounterPage() {
    const [count, setCount] = useState(0);
    return _jsxs("main", { children: [_jsxs("h1", { className: local.bruh, children: ["Current count: ", count] }), _jsxs("div", { children: [_jsx("button", { onClick: () => setCount(count + 1), children: "Increase" }), _jsx("button", { onClick: () => setCount(count - 1), children: "Decrease" })] })] });
}
