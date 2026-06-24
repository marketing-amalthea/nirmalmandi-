import '@testing-library/jest-dom';

// jsdom does not implement these — stub so components that touch them don't crash.
if (typeof window !== 'undefined') {
  window.matchMedia =
    window.matchMedia ||
    ((query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      } as unknown as MediaQueryList));

  // scrollTo used by some UI components
  window.scrollTo = window.scrollTo || (jest.fn() as any);
}
