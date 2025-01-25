import { NextResponse } from "next/server";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import axios from "axios";
import gtts from "gtts";

export async function POST(request: Request) {
  try {
    const chunks: Buffer[] = [];
    const reader = request.body?.getReader();

    if (!reader) {
      return NextResponse.json(
        { message: "No request body found" },
        { status: 400 }
      );
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(Buffer.from(value));
    }

    const buffer = Buffer.concat(chunks);

    // Ensure the public directory exists
    const publicDir = path.join(process.cwd(), "public");
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    // Save the recording file
    const filePath = path.join(publicDir, "recording.webm");
    console.log("Saving recording to:", filePath);
    await fsPromises.writeFile(filePath, buffer);
    console.log("Recording saved successfully.");

    // Use a free API for speech-to-text (e.g., AssemblyAI)
    const assembly = axios.create({
      baseURL: "https://api.assemblyai.com/v2",
      headers: {
        authorization: process.env.NEXT_ASSEMBLY_API_KEY, // Your AssemblyAI API key
        "content-type": "application/json",
      },
    });

    // Upload the file to AssemblyAI
    const uploadResponse = await assembly.post("/upload", buffer);
    console.log("AssemblyAI upload response:", uploadResponse.data);

    const audioUrl = uploadResponse.data.upload_url;
    console.log("Audio URL for transcription:", audioUrl);

    // Transcribe the audio
    const transcriptResponse = await assembly.post("/transcript", {
      audio_url: audioUrl,
    });
    console.log("Transcript response:", transcriptResponse.data);

    const transcriptId = transcriptResponse.data.id;
    console.log("Transcript ID:", transcriptId);

    // Poll for transcription completion
    let transcriptText = "";
    while (true) {
      const transcriptResult = await assembly.get(
        `/transcript/${transcriptId}`
      );
      console.log("Transcript status:", transcriptResult.data.status);

      if (transcriptResult.data.status === "completed") {
        transcriptText = transcriptResult.data.text;
        console.log("Transcript text:", transcriptText);
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Generate a dynamic chatbot response
    const chatbotResponseText = generateChatbotResponse(transcriptText);

    // Use gTTS for text-to-speech
    const uniqueFileName = `response-${Date.now()}.mp3`; // Unique file name
    const audioFilePath = path.join(publicDir, uniqueFileName);
    console.log("Saving response audio to:", audioFilePath);

    await new Promise<void>((resolve, reject) => {
      const gttsInstance = new gtts(chatbotResponseText, "en");
      gttsInstance.save(audioFilePath, (err) => {
        if (err) {
          console.error("Error saving gTTS audio:", err);
          reject(new Error("Failed to generate response audio."));
        } else {
          console.log("Response audio saved successfully.");
          resolve();
        }
      });
    });

    // Return both the text and audio URL
    return NextResponse.json(
      {
        text: chatbotResponseText,
        audioUrl: `/${uniqueFileName}`,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

// Generate a dynamic chatbot response
const generateChatbotResponse = (userInput: string): string => {
  // Simple rule-based responses
  const input = userInput.toLowerCase();

  if (input.includes("hello") || input.includes("hi")) {
    return "Hello! How can I assist you today?";
  }
  if (input.includes("weather")) {
    return "I'm not sure about the weather, but you can check a weather app for updates!";
  }
  if (input.includes("thank you") || input.includes("thanks")) {
    return "You're welcome! Let me know if you need anything else.";
  }
  if (input.includes("time")) {
    return `I'm not equipped to tell the time, but you can easily check your device's clock!`;
  }
  if (input.includes("your name") || input.includes("who are you")) {
    return "I'm your friendly chatbot here to assist with your queries!";
  }
  if (input.includes("help")) {
    return "Sure! Let me know what you need help with.";
  }
  if (input.includes("bye") || input.includes("goodbye")) {
    return "Goodbye! Have a great day!";
  }
  if (input.includes("joke")) {
    return "Why don't scientists trust atoms? Because they make up everything!";
  }
  if (input.includes("food")) {
    return "I'm a chatbot, so I don't eat, but I hear pizza is always a great choice!";
  }
  if (input.includes("movie")) {
    return "I enjoy hearing about movies, but I'm not equipped to watch them. Have you seen anything interesting lately?";
  }

  return `You said: "${userInput}". How can I assist you further?`;
};