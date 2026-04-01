import { findBestPoemMatch, type PoemMatcherRequestMessage, type PoemMatcherResponseMessage } from '../poemLibrary';

const workerGlobal = self as unknown as {
  onmessage: ((event: MessageEvent<PoemMatcherRequestMessage>) => void) | null;
  postMessage: (message: PoemMatcherResponseMessage) => void;
};

workerGlobal.onmessage = (event: MessageEvent<PoemMatcherRequestMessage>) => {
  const message = event.data;

  if (!message || message.type !== 'find_match') {
    return;
  }

  const suggestion = findBestPoemMatch(message.query, message.language);
  const response: PoemMatcherResponseMessage = {
    type: 'match_result',
    requestId: message.requestId,
    suggestion,
  };

  workerGlobal.postMessage(response);
};

export {};
