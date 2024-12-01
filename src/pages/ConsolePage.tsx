import React, { useEffect, useRef, useState } from 'react';
import { RealtimeClient } from '@openai/realtime-api-beta';
import { WavRecorder, WavStreamPlayer } from '../lib/wavtools/index.js';

const LOCAL_RELAY_SERVER_URL: string = process.env.REACT_APP_LOCAL_RELAY_SERVER_URL || '';
const apiKey = process.env.REACT_APP_OPENAI_API_KEY || '';

if (!apiKey) {
  throw new Error('Missing OpenAI API Key. Please set REACT_APP_OPENAI_API_KEY.');
}

export function VoiceInteractionPage() {
  const wavRecorderRef = useRef<WavRecorder>(new WavRecorder({ sampleRate: 24000 }));
  const wavStreamPlayerRef = useRef<WavStreamPlayer>(new WavStreamPlayer({ sampleRate: 24000 }));
  const clientRef = useRef<RealtimeClient>(
    new RealtimeClient(
      LOCAL_RELAY_SERVER_URL
        ? { url: LOCAL_RELAY_SERVER_URL }
        : { apiKey: apiKey, dangerouslyAllowAPIKeyInBrowser: true }
    )
  );

  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const connectConversation = async () => {
      const client = clientRef.current;
      const wavRecorder = wavRecorderRef.current;
      const wavStreamPlayer = wavStreamPlayerRef.current;

      setIsConnected(true);

      // Imposta sempre la modalità VAD
      client.updateSession({
        turn_detection: { type: 'server_vad' },
      });

      if (client.isConnected()) {
        await wavRecorder.begin();
        await wavStreamPlayer.connect();
        await client.connect();

        // Gestisci il flusso audio dal microfono
        wavRecorder.record((data) => client.appendInputAudio(data.mono));

        // Imposta le risposte vocali
        client.on('conversation.updated', async ({ item }: any) => {
          if (item.status === 'completed' && item.formatted.audio?.length) {
            const wavFile = await WavRecorder.decode(item.formatted.audio, 24000, 24000);
            item.formatted.file = wavFile;
            wavStreamPlayer.playAudio(wavFile);  // Riproduci la risposta
          }
        });
      }
    };

    if (!isConnected) {
      connectConversation().catch((error) => console.error('Error connecting to API:', error));
    }

    return () => {
      // Cleanup
      const client = clientRef.current;
      client.disconnect();
      wavRecorderRef.current.end();
      wavStreamPlayerRef.current.interrupt();
    };
  }, [isConnected]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f0f0f0' }}>
      <h1>Ascolto attivo dell'assistente vocale...</h1>
      <div style={{ visibility: isRecording ? 'visible' : 'hidden' }}>
        <p>Stai parlando...</p>
      </div>
    </div>
  );
}



