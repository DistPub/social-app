import { useEffect, useState } from 'react';

export default function useIOSStatusBarFix() {
  const [top, setTop] = useState('0px')

  useEffect(() => {
    const read = () => {
      const overlap = globalThis.getComputedStyle(
        globalThis.document.documentElement
      ).getPropertyValue('--ios-status-bar');
      setTop(overlap);
    };

    read();
    globalThis.window.addEventListener('pageshow', read);
    globalThis.window.addEventListener('resize', read);

    return () => {
      globalThis.window.removeEventListener('pageshow', read);
      globalThis.window.removeEventListener('resize', read);
    };
  }, []);

  return top;
}
