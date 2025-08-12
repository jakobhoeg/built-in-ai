export async function GET() {
  return new Response("This endpoint is disabled for now", { status: 503 });
}

// import { convertToModelMessages, streamText, UIMessage, createUIMessageStream, createUIMessageStreamResponse } from "ai";

// export const maxDuration = 30;

// export async function POST(req: Request) {
//   const { messages }: { messages: UIMessage[] } = await req.json();

//   const model = transformersJS('HuggingFaceTB/SmolLM2-135M-Instruct'); // Don't use a model too big

//   const availability = await model.availability();

//   if (availability === "available") {
//     // Model is ready, stream directly
//     const result = streamText({
//       model,
//       messages: convertToModelMessages(messages),
//       temperature: 0.7,
//     });
//     return result.toUIMessageStreamResponse();
//   }

//   const stream = createUIMessageStream({
//     execute: async ({ writer }) => {
//       try {
//         let downloadProgressId: string | undefined;

//         await model.createSessionWithProgress((progress: { progress: number }) => {
//           const percent = Math.round(progress.progress * 100);

//           if (progress.progress >= 1) {
//             if (downloadProgressId) {
//               writer.write({
//                 type: "data-modelDownloadProgress",
//                 id: downloadProgressId,
//                 data: {
//                   status: "complete",
//                   progress: 100,
//                   message: "Model finished loading! Getting ready for inference...",
//                 },
//               });
//             }
//             return;
//           }

//           // First progress update
//           if (!downloadProgressId) {
//             downloadProgressId = `download-${Date.now()}`;
//             writer.write({
//               type: "data-modelDownloadProgress",
//               id: downloadProgressId,
//               data: {
//                 status: "downloading",
//                 progress: percent,
//                 message: "Model is loading on the server...",
//               },
//               transient: true,
//             });
//             return;
//           }

//           // Ongoing progress updates
//           writer.write({
//             type: "data-modelDownloadProgress",
//             id: downloadProgressId,
//             data: {
//               status: "downloading",
//               progress: percent,
//               message: `Model is loading on the server... ${percent}%`,
//             },
//           });
//         });

//         const result = streamText({
//           model,
//           messages: convertToModelMessages(messages),
//           temperature: 0.7,
//           onChunk(event) {
//             // Clear progress message on first text chunk
//             if (event.chunk.type === "text-delta" && downloadProgressId) {
//               writer.write({
//                 type: "data-modelDownloadProgress",
//                 id: downloadProgressId,
//                 data: { status: "complete", progress: 100, message: "" },
//               });
//               downloadProgressId = undefined;
//             }
//           },
//         });

//         writer.merge(result.toUIMessageStream({ sendStart: false }));
//       } catch (error) {
//         writer.write({
//           type: "data-notification",
//           data: {
//             message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
//             level: "error",
//           },
//           transient: true,
//         });
//         throw error;
//       }
//     },
//   });

//   return createUIMessageStreamResponse({ stream });
// }
