import React, { useEffect, useRef, useCallback, useState } from 'react';
import { RealtimeClient } from '@openai/realtime-api-beta';
import { ItemType } from '@openai/realtime-api-beta/dist/lib/client.js';
import { WavRecorder, WavStreamPlayer } from '../lib/wavtools/index.js';
import './ConsolePage.scss';

export function ConsolePage() {
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY || '';
  if (!apiKey) {
    throw new Error('Missing OpenAI API Key. Please set REACT_APP_OPENAI_API_KEY.');
  }

  const LOCAL_RELAY_SERVER_URL: string = process.env.REACT_APP_LOCAL_RELAY_SERVER_URL || '';

  const clientRef = useRef<RealtimeClient>(
    new RealtimeClient(
      LOCAL_RELAY_SERVER_URL
        ? { url: LOCAL_RELAY_SERVER_URL }
        : {
            apiKey: apiKey,
            dangerouslyAllowAPIKeyInBrowser: true,
          }
    )
  );

  const [items, setItems] = useState<ItemType[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const connectConversation = useCallback(async () => {
    const client = clientRef.current;
    setIsConnected(true);
    setItems(client.conversation.getItems());

    await client.connect();
    client.sendUserMessageContent([
      {
        type: `input_text`,
        text: `Hello!`,
      },
    ]);
  }, []);

  const disconnectConversation = useCallback(async () => {
    setIsConnected(false);
    setItems([]);
    const client = clientRef.current;
    client.disconnect();
  }, []);

  useEffect(() => {
    if (!isConnected) {
      connectConversation()
        .then(() => console.log('Connected successfully.'))
        .catch((error) => {
          console.error('Failed to auto-connect:', error);
        });
    }
  }, [isConnected, connectConversation]);

  return (
    <div data-component="ConsolePage">
      <div className="navbar">
        <img src="/logo_cartesian_web.svg" alt="Logo" />
      </div>
      <div className="transcript-window">
        {items.map((item) => (
          <div key={item.id} className={`transcript-item ${item.role}`}>
            <div className="transcript-role">{item.role}</div>
            <div className="transcript-content">
              {item.formatted.transcript || item.formatted.text || ''}
            </div>
          </div>
        ))}
      </div>
      <div className="action-buttons">
        <button onClick={isConnected ? disconnectConversation : connectConversation}>
          {isConnected ? 'Stop Conversation' : 'Start Conversation'}
        </button>
      </div>
    </div>
  );
}

