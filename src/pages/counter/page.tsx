import { useState } from 'preact/hooks';

export default function CounterPage() {
    const [count, setCount] = useState(0);

    return <main>
        <h1>Current count: {count}</h1>
        <div style={{ display: 'flex', flexDirection: 'row', gap: '0.5rem' }}>
            <button onClick={() => setCount(count + 1)}>Increase</button>
            <button onClick={() => setCount(count - 1)}>Decrease</button>
        </div>
    </main>
}