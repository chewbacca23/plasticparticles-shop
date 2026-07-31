// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Tone.js ships ESM that CRA's Jest doesn't transform — stub it for unit tests.
jest.mock('tone', () => ({}));
