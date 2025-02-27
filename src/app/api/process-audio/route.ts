import { NextResponse } from "next/server";
import axios from "axios";
import { v2 as cloudinary } from "cloudinary";
import os from "os";
import path from "path";
import gtts from "gtts";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: Request) {
  try {
    // Read the audio file from the request body
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

    // Step 1: Upload the audio file to AssemblyAI
    const assembly = axios.create({
      baseURL: "https://api.assemblyai.com/v2",
      headers: {
        authorization: process.env.NEXT_ASSEMBLY_API_KEY,
        "content-type": "application/json",
      },
    });

    const uploadResponse = await assembly.post("/upload", buffer);
    const audioUrl = uploadResponse.data.upload_url;
    console.log("Audio URL for transcription:", audioUrl);

    // Step 2: Transcribe the audio using AssemblyAI
    const transcriptResponse = await assembly.post("/transcript", {
      audio_url: audioUrl,
    });
    const transcriptId = transcriptResponse.data.id;
    console.log("Transcript ID:", transcriptId);

    // Poll for transcription completion
    let transcriptText = "";
    while (true) {
      const transcriptResult = await assembly.get(`/transcript/${transcriptId}`);
      console.log("Transcript status:", transcriptResult.data.status);

      if (transcriptResult.data.status === "completed") {
        transcriptText = transcriptResult.data.text;
        console.log("Transcript text:", transcriptText);
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second before polling again
    }

    // Step 3: Generate a chatbot response
    const chatbotResponseText = generateChatbotResponse(transcriptText);

    // Step 4: Convert the chatbot response to speech using gTTS
    const tempFilePath = path.join(os.tmpdir(), `response-${Date.now()}.mp3`);

    await new Promise<void>((resolve, reject) => {
      const gttsInstance = new gtts(chatbotResponseText, "en");
      gttsInstance.save(tempFilePath, (err) => {
        if (err) {
          console.error("Error saving gTTS audio:", err);
          reject(new Error("Failed to generate response audio."));
        } else {
          resolve();
        }
      });
    });

    // Step 5: Upload the generated audio to Cloudinary
    const cloudinaryResponse = await cloudinary.uploader.upload(tempFilePath, {
      resource_type: "video", // Use "video" for audio files
    });
    const audioUrlCloudinary = cloudinaryResponse.secure_url;
    console.log("Audio uploaded to Cloudinary:", audioUrlCloudinary);

    // Step 6: Return the chatbot response text and Cloudinary audio URL
    return NextResponse.json(
      {
        text: chatbotResponseText,
        audioUrl: audioUrlCloudinary,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error in /api/process-audio:", error);
    return NextResponse.json(
      { message: "Failed to process audio. Please try again.", error: error.message },
      { status: 500 }
    );
  }
}

// Generate a dynamic chatbot response
const generateChatbotResponse = (userInput: string): string => {
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
    return "I'm not equipped to tell the time, but you can easily check your device's clock!";
  }
  if (input.includes("your name") || input.includes("who are you")) {
    return "I'm your friendly chatbot here to assist with your queries!";
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