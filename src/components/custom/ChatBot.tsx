"use client";

import { useState, useEffect } from "react";
import { FaPlay, FaPause, FaTrash } from "react-icons/fa";

type ChatItem = {
  text: string;
  audioUrl: string;
  isPlaying: boolean; 
  audioInstance?: HTMLAudioElement;
};

const Chatbot = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load chat history from localStorage on component mount
  useEffect(() => {
    const savedChatHistory = localStorage.getItem("chatHistory");
    if (savedChatHistory) {
      setChatHistory(JSON.parse(savedChatHistory));
    }
  }, []);

  // Save chat history to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
  }, [chatHistory]);

  const handleRecord = async () => {
    setIsRecording(true);
    setError(null); // Reset any previous errors
  
    try {
      // Request access to the user's microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      const audioChunks: Blob[] = [];
  
      // Collect audio data chunks
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };
  
      // When recording stops, process the audio
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
  
        // Convert the Blob to an ArrayBuffer
        const arrayBuffer = await audioBlob.arrayBuffer();
  
        // Send audio to the backend
        try {
          const response = await fetch("/api/process-audio", {
            method: "POST",
            body: arrayBuffer,
            headers: {
              "Content-Type": "audio/webm",
            },
          });
  
          if (!response.ok) {
            throw new Error(`Failed to process audio: ${response.statusText}`);
          }
  
          const { text, audioBase64 } = await response.json();
  
          // Add the chatbot's response to the chat history
          setChatHistory((prev) => [
            ...prev,
            { text, audioUrl: `data:audio/mp3;base64,${audioBase64}`, isPlaying: false },
          ]);
        } catch (err) {
          console.error("Error processing audio:", err);
          setError("Failed to process audio. Please try again.");
        }
      };
  
      // Start recording
      mediaRecorder.start();
  
      // Stop recording after 5 seconds
      setTimeout(() => {
        mediaRecorder.stop();
        setIsRecording(false);
        stream.getTracks().forEach((track) => track.stop()); // Stop the microphone stream
      }, 5000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("Microphone access denied. Please allow access to continue.");
      setIsRecording(false);
    }
  };

  const toggleAudio = (index: number) => {
    setChatHistory((prev) =>
      prev.map((chat, i) => {
        if (i === index) {
          // Create or reuse the audio instance
          const audio = chat.audioInstance || new Audio(chat.audioUrl);

          // Add event listener for when the audio ends
          audio.addEventListener("ended", () => {
            setChatHistory((prev) =>
              prev.map((chat, idx) =>
                idx === index ? { ...chat, isPlaying: false } : chat
              )
            );
          });

          if (chat.isPlaying) {
            audio.pause(); // Pause the audio
          } else {
            audio.play(); // Play the audio
          }

          return { ...chat, isPlaying: !chat.isPlaying, audioInstance: audio }; // Toggle isPlaying state and store the audio instance
        }
        return chat;
      })
    );
  };

  const deleteResponse = (index: number) => {
    setChatHistory((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <button
        title="Start Recording"
        onClick={handleRecord}
        disabled={isRecording}
        className="px-6 py-3 text-white rounded-full transition-colors bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 disabled:from-gray-400 disabled:to-gray-500"
      >
        {isRecording ? "Recording..." : "Start Recording"}
      </button>

      {error && (
        <p className="mt-4 text-red-500 text-center">{error}</p>
      )}

      <div className="mt-8 w-full max-w-md">
      {chatHistory.length === 0 ? (
        
        <div className="mt-8 text-center text-gray-600">
          <p>No chat history yet. Start recording to see AI in action!</p>
        </div>
      ) : (
        
        <div className="mt-8 w-full max-w-md">
          {chatHistory.map((chat, index) => (
            <div key={index} className="mb-4 p-4 bg-[#fff0d9] rounded-lg shadow">
              <p className="text-gray-800">{chat.text}</p>
              <div className="flex justify-between gap-2 mt-4 p-2">
                <button
                  title="Play/Pause"
                  onClick={() => toggleAudio(index)}
                  className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 flex items-center justify-center"
                >
                  {chat.isPlaying ? <FaPause /> : <FaPlay />}
                </button>
                <button
                  title="Delete"
                  onClick={() => deleteResponse(index)}
                  className="p-3 bg-red-500 text-white rounded-full hover:bg-red-600 flex items-center justify-center"
                >
                  <FaTrash />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
};

export default Chatbot;