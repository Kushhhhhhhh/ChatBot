declare module "gtts" {
    class gTTS {
      constructor(text: string, lang: string);
      save(filePath: string, callback: (err: Error | null) => void): void;
    }
  
    export = gTTS;
  }