import { useState } from 'preact/hooks';

// Image and css modules work out of the box!!
import local from './local.module.css';

export default function CounterPage() {
    const [count, setCount] = useState(0);

    return <main>
        <h1 className={local.bruh}>Current count: {count}</h1>
        <div>
            <button onClick={() => setCount(count + 1)}>Increase</button>
            <button onClick={() => setCount(count - 1)}>Decrease</button>
        </div>
    </main>
}