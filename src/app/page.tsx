import Chatbot from "@/components/custom/ChatBot";

export default function Home() {
  return (
    <main className="w-full min-h-screen flex flex-col items-center px-20">
        <h2 className="text-2xl md:text-5xl font-sans font-extrabold my-10">Chatbot 🤖</h2>
        <section className="w-full max-w-3xl mt-10">
          <Chatbot />
        </section> 
    </main>
  );
}