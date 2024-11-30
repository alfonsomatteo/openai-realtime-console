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

  const wavRecorderRef = useRef<WavRecorder>(new WavRecorder({ sampleRate: 24000 }));
  const wavStreamPlayerRef = useRef<WavStreamPlayer>(new WavStreamPlayer({ sampleRate: 24000 }));

  const [items, setItems] = useState<ItemType[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const connectConversation = useCallback(async () => {
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;

    // Set state variables
    setIsConnected(true);
    setItems(client.conversation.getItems());

    // Connect to microphone
    await wavRecorder.begin();

    // Connect to audio output
    await wavStreamPlayer.connect();

    // Connect to realtime API
    await client.connect();
    client.sendUserMessageContent([
      {
        type: `input_text`,
        text: `Hello!`,
      },
    ]);

    await wavRecorder.record((data) => client.appendInputAudio(data.mono));
  }, []);

  const disconnectConversation = useCallback(async () => {
    setIsConnected(false);
    setItems([]);
    const client = clientRef.current;
    client.disconnect();

    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.end();

    const wavStreamPlayer = wavStreamPlayerRef.current;
    await wavStreamPlayer.interrupt();
  }, []);

  const startRecording = async () => {
    setIsRecording(true);
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const trackSampleOffset = await wavStreamPlayer.interrupt();
    if (trackSampleOffset?.trackId) {
      const { trackId, offset } = trackSampleOffset;
      await client.cancelResponse(trackId, offset);
    }
    await wavRecorder.record((data) => client.appendInputAudio(data.mono));
  };

  const stopRecording = async () => {
    setIsRecording(false);
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.pause();
    client.createResponse();
  };

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
        {isConnected && (
          <button onClick={isRecording ? stopRecording : startRecording}>
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </button>
        )}
      </div>
    </div>
  );
}
