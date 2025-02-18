/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { Button } from "@/src/components/ui/button";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { Card } from "@/src/components/ui/card";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import { Textarea } from "@/src/components/ui/textarea";
import { agentChat } from "@/src/services/socraticServices";
import { useUser } from "@clerk/nextjs";
import { saveConversations } from "@/src/services/conversationService";
import { ListPlus } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/src/components/ui";

const getCurrentTime = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

interface IMessage {
  id: number;
  sender: string;
  text: string;
  time: string;
  image: string | null;
}

interface IConversation {
  id: string;
  messages: IMessage[];
}

export interface IConversationRequest {
  user_email: string;
  conversations: IConversation[];
}

const ChatPage = () => {
  const { user } = useUser();
  const [sessions, setSessions] = useState<IConversation[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>("");
  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState<string>("");

  // Filter out sessions that start with "session-" or are empty
  const filteredSessions = sessions.filter(
    (session) => !session.id.startsWith("session-") && session.id !== ""
  );

  const currentSession = sessions.find(
    (session) => session.id === currentSessionId
  );
  const messages = currentSession ? currentSession.messages : [];

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, scrollToBottom]);

  const handleSendMessage = async () => {
    if (!userInput.trim() && !image) return;

    const userMessage: IMessage = {
      id: Date.now(),
      sender: "user",
      text: userInput,
      time: getCurrentTime(),
      image: image ? URL.createObjectURL(image) : null,
    };

    const updatedMessages = [...messages, userMessage];
    updateSessionMessages(currentSessionId, updatedMessages);

    setUserInput("");
    setImagePreview(null);
    setImage(null);
    setLoading(true);
    setStreamingText("");

    try {
      const response = await agentChat({
        session_id: currentSessionId,
        user_request: userInput,
        image: image,
      });

      const botMessageId = Date.now() + 1;
      const botMessage: IMessage = {
        id: botMessageId,
        sender: "bot",
        text: "",
        time: getCurrentTime(),
        image: null,
      };

      updateSessionMessages(response.session_id, [
        ...updatedMessages,
        botMessage,
      ]);
      setCurrentSessionId(response.session_id);

      for (let i = 0; i < response.question.length; i++) {
        botMessage.text += response.question[i];
        updateSessionMessages(response.session_id, [
          ...updatedMessages,
          { ...botMessage },
        ]);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      await handleSaveConversation();
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: IMessage = {
        id: Date.now() + 2,
        sender: "bot",
        text: "Oops! Something went wrong. Please try again.",
        time: getCurrentTime(),
        image: null,
      };
      updateSessionMessages(currentSessionId, [
        ...updatedMessages,
        errorMessage,
      ]);
    } finally {
      setLoading(false);
    }
  };

  const updateSessionMessages = useCallback(
    (sessionId: string, newMessages: IMessage[]) => {
      setSessions((prevSessions) => {
        const sessionIndex = prevSessions.findIndex(
          (session) => session.id === sessionId
        );
        if (sessionIndex >= 0) {
          const updatedSessions = [...prevSessions];
          updatedSessions[sessionIndex].messages = newMessages;
          return updatedSessions;
        } else {
          return [...prevSessions, { id: sessionId, messages: newMessages }];
        }
      });
    },
    []
  );

  const handleNewConversation = useCallback(() => {
    const newSessionId = `session-${Date.now()}`;
    setCurrentSessionId(newSessionId);
    updateSessionMessages(newSessionId, [
      {
        id: 1,
        sender: "bot",
        text: "Hello! How can I assist you today?",
        time: getCurrentTime(),
        image: null,
      },
    ]);
    setIsSidebarOpen(false);
  }, [updateSessionMessages]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        alert("Image size must be less than 5MB.");
        return;
      }
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
      setUserInput("What's in the image?");
    }
  };

  const handleRemoveImage = () => {
    setImage(null);
    setImagePreview(null);
  };

  const handleSaveConversation = async () => {
    if (!user?.emailAddresses[0]?.emailAddress || !currentSession) return;

    const conversationRequest: IConversationRequest = {
      user_email: user.emailAddresses[0].emailAddress,
      conversations: [currentSession],
    };

    try {
      await saveConversations(conversationRequest);
    } catch (error) {
      console.error("Failed to save conversation:", error);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row h-full bg-gray-50">
      {/* Sidebar */}
      <div
        className={`fixed sm:static z-40 h-screen sm:h-auto bg-white border-r shadow-lg flex flex-col transform ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } transition-transform duration-300 sm:translate-x-0 w-64 hidden sm:block`}
      >
        {/* Sidebar Content */}
        <div className="flex items-center justify-start ml-4">
          <Image
            src="/images/logo.png"
            alt="LAAI"
            width={40}
            height={40}
            className="animate-pulse"
          />
          <h3 className="text-lg font-semibold p-4 text-gray-800">
            Chat History
          </h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleNewConversation}
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors ml-auto mr-2"
                  aria-label="Add New Conversation"
                >
                  <ListPlus className="w-6 h-6" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Add New Conversation</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Chat History */}
        <ScrollArea className="flex-1 p-3 space-y-2">
          {filteredSessions.length === 0 ? (
            <p className="text-sm text-gray-500 text-center">
              No history yet. Start a conversation!
            </p>
          ) : (
            filteredSessions.map((session) => (
              <Card
                key={session.id}
                className={`px-4 py-2 cursor-pointer rounded-md shadow-sm transition duration-150 ease-in-out mb-2 ${
                  session.id === currentSessionId
                    ? "bg-blue-100 hover:bg-blue-200"
                    : "bg-gray-50 hover:bg-gray-100"
                }`}
                onClick={() => {
                  setCurrentSessionId(session.id);
                  setIsSidebarOpen(false);
                }}
              >
                <span className="font-sans font-semibold text-gray-700 text-sm">
                  {session.messages.find((msg) => msg.sender === "user")
                    ?.text || "New Session"}
                </span>
              </Card>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Chat Interface */}
      <div className="flex flex-col flex-1 sm:my-0 sm:mx-0 sm:p-2 lg:p-2">
        <ScrollArea className="flex-1 px-2 space-y-2 py-4">
          {/* Messages */}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex w-full items-end ${
                message.sender === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {message.sender === "bot" && (
                <Avatar className="mr-2">
                  <AvatarImage
                    src="/images/BotAvatar.svg"
                    alt="Bot"
                    className="w-8 h-8 object-cover animate-pulse"
                  />
                  <AvatarFallback>🤖</AvatarFallback>
                </Avatar>
              )}

              <div className="flex flex-col max-w-md">
                <Card
                  className={`px-4 py-2 shadow-lg ${
                    message.sender === "user"
                      ? "bg-gradient-to-r from-blue-500 to-blue-400 text-white rounded-3xl rounded-br-sm ml-2"
                      : "bg-gradient-to-r from-gray-200 to-gray-100 text-gray-800 rounded-3xl rounded-bl-sm mr-2"
                  }`}
                >
                  {message.text}
                  {message.image && (
                    <Image
                      src={message.image}
                      alt="Attached"
                      className="mt-2 max-w-xs rounded-lg"
                      width={200}
                      height={200}
                    />
                  )}
                </Card>

                <span
                  className={`text-xs mt-1 ${
                    message.sender === "user"
                      ? "text-right text-gray-400"
                      : "text-left text-gray-500"
                  }`}
                >
                  {message.time}
                </span>
              </div>

              {message.sender === "user" && (
                <Avatar className="ml-2">
                  {user?.imageUrl ? (
                    <img
                      src={user?.imageUrl}
                      alt="User Profile"
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <AvatarImage
                      src="/images/userAvatar.svg"
                      alt="User"
                      className="w-8 h-8 object-cover"
                    />
                  )}
                </Avatar>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </ScrollArea>

        {/* Input Area */}
        <div className="flex flex-col px-4 pt-4 pb-3 bg-white border border-gray-100 rounded-2xl shadow-lg space-y-2">
          {/* Message Input */}
          <Textarea
            placeholder="Type your message here..."
            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            disabled={loading}
            aria-label="Type your message"
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
          />

          {/* Image Preview */}
          {imagePreview && (
            <div className="relative">
              <Image
                src={imagePreview}
                alt="Preview"
                className="mt-2 max-w-xs rounded-lg shadow-sm"
                width={200}
                height={200}
              />
              <button
                onClick={handleRemoveImage}
                className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-md hover:bg-gray-50 transition-colors"
                aria-label="Remove image"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 text-gray-600"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            {/* File Upload and Icons */}
            <div className="flex items-center space-x-2">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                disabled={loading}
                className="hidden"
                id="image-upload"
              />
              <label
                htmlFor="image-upload"
                className="cursor-pointer p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Attach image"
              >
                <Image
                  src="/images/Paperclip.svg"
                  alt="Attach Image"
                  width={16}
                  height={16}
                  className="w-4 h-4"
                />
              </label>

              {/* Additional Icons */}
              {["Grid", "Microphone", "Element"].map((icon) => (
                <button
                  key={icon}
                  className="p-1.5 rounded-full hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
                  aria-label={icon}
                >
                  <Image
                    src={`/images/${icon}.svg`}
                    alt={icon}
                    width={16}
                    height={16}
                    className="w-4 h-4"
                  />
                </button>
              ))}
            </div>

            {/* Send Button */}
            <Button
              onClick={handleSendMessage}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md shadow-sm text-sm text-white ${
                loading
                  ? "bg-blue-400 cursor-not-allowed"
                  : "bg-blue-500 hover:bg-blue-600"
              } transition-colors`}
              disabled={loading}
              aria-label="Send message"
            >
              {loading ? (
                <div className="flex items-center space-x-1.5">
                  <Image
                    src="/images/logo.png"
                    alt="Loading"
                    width={16}
                    height={16}
                    className="w-4 h-4 animate-spin"
                  />
                  <span>Analyzing...</span>
                </div>
              ) : (
                <>
                  <Image
                    src="/images/Send.svg"
                    alt="Send"
                    width={16}
                    height={16}
                    className="w-4 h-4"
                  />
                  <span className="md:inline">Send</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
