import { NextRequest, NextResponse } from "next/server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { promises as fs } from "fs";
import path from "path";
import OpenAI from "openai";

const VAULT_PATH = "C:\\Users\\vanio\\OneDrive\\Área de Trabalho\\teste_crew\\teste";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface MCPToolResult {
  content: Array<{
    type: string;
    text?: string;
  }>;
}

interface Source {
  title: string;
  path: string;
  snippet: string;
}

interface ChatResponse {
  answer: string;
  sources: Source[];
}

let mcpClient: Client | null = null;
let currentVaultPath: string | null = null;

async function initMCPClient(vaultPath: string): Promise<Client> {
  // If we have a client and it's for the same vault path, reuse it
  if (mcpClient && currentVaultPath === vaultPath) {
    return mcpClient;
  }

  // Close old client if vault path changed
  if (mcpClient && currentVaultPath !== vaultPath) {
    try {
      await mcpClient.close();
    } catch (error) {
      console.error("Error closing old MCP client:", error);
    }
    mcpClient = null;
  }

  try {
    const client = new Client({
      name: "obsidian-chat",
      version: "1.0.0",
    });

    const transport = new StdioClientTransport({
      command: "npx",
      args: ["mcp-obsidian", vaultPath],
    });

    await client.connect(transport);
    mcpClient = client;
    currentVaultPath = vaultPath;
    return client;
  } catch (error) {
    console.error("Failed to initialize MCP client:", error);
    throw error;
  }
}

async function searchNotes(query: string, vaultPath: string, tag?: string): Promise<Array<{ title: string; path: string; content: string }>> {
  try {
    const client = await initMCPClient(vaultPath);

    const normalizedTag = tag?.trim().replace(/^#/, "");
    const searchQuery = normalizedTag ? `${query} #${normalizedTag}` : query;
    
    const result = (await client.callTool({
      name: "search",
      arguments: {
        query: searchQuery,
      },
    })) as MCPToolResult;

    const text = result.content?.[0]?.text || "[]";
    const notes = JSON.parse(text);

    // Limit to top 5 results
    return notes.slice(0, 5).map((note: any) => ({
      title: note.title || "Untitled",
      path: note.path || "",
      content: note.content || "",
    }));
  } catch (error) {
    console.error("Search error:", error);
    return [];
  }
}

async function readNoteContent(pathStr: string, vaultPath: string): Promise<string> {
  try {
    const client = await initMCPClient(vaultPath);
    
    const result = (await client.callTool({
      name: "read_note",
      arguments: {
        path: pathStr,
      },
    })) as MCPToolResult;

    return result.content?.[0]?.text || "";
  } catch (error) {
    console.error(`Failed to read note at ${pathStr}:`, error);
    return "";
  }
}

async function listAllNotesFromDirectory(vaultPath: string): Promise<Array<{ title: string; path: string }>> {
  try {
    const notes: Array<{ title: string; path: string }> = [];

    async function walkDir(dir: string, baseDir: string) {
      const files = await fs.readdir(dir);
      
      for (const file of files) {
        // Skip hidden directories
        if (file.startsWith(".")) continue;
        
        const fullPath = path.join(dir, file);
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory()) {
          // Recursively walk subdirectories
          await walkDir(fullPath, baseDir);
        } else if (file.endsWith(".md")) {
          // Add markdown files
          const relativePath = path.relative(baseDir, fullPath);
          const title = file.replace(".md", "");
          notes.push({
            title,
            path: relativePath,
          });
        }
      }
    }

    await walkDir(vaultPath, vaultPath);
    return notes;
  } catch (error) {
    console.error("List notes error:", error);
    return [];
  }
}

async function queryOpenAI(
  question: string,
  notesContext: Array<{ title: string; path: string; content: string }>
): Promise<{ answer: string; sources: Source[] }> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  const contextText = notesContext
    .map((note) => `# ${note.title}\nPath: ${note.path}\n\n${note.content}`)
    .join("\n\n---\n\n");

  const systemPrompt = `You are a helpful assistant that answers questions based on the provided notes from an Obsidian vault. 
You can answer questions about the vault's structure (like "how many notes do I have?"), specific content from notes, or general knowledge.
When answering from the notes, cite which note(s) you used.
Keep answers concise and relevant.`;

  const userPrompt = `Question: ${question}

Notes context:
${contextText}

Please answer based only on the information in these notes.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 1000,
  });

  const answer = response.choices[0].message.content || "No answer generated";

  const sources = notesContext.map((note) => ({
    title: note.title,
    path: note.path,
    snippet: note.content.substring(0, 200) + (note.content.length > 200 ? "..." : ""),
  }));

  return { answer, sources };
}

export async function POST(request: NextRequest): Promise<NextResponse<ChatResponse>> {
  try {
    const body = await request.json() as { message: string; tag?: string; vaultPath?: string };
    const { message, tag, vaultPath } = body;

    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { answer: "Please provide a question", sources: [] },
        { status: 400 }
      );
    }

    // Use provided vault path or fall back to default
    const pathToUse = vaultPath || VAULT_PATH;

    // Search for relevant notes
    const searchResults = await searchNotes(message, pathToUse, tag);

    let notesWithContent: Array<{ title: string; path: string; content: string }> = [];

    if (searchResults.length === 0) {
      // If search found nothing, list all notes and pass them to OpenAI
      // This allows answering meta-questions like "how many notes do i have?"
      const allNotes = await listAllNotesFromDirectory(pathToUse);
      
      if (allNotes.length === 0) {
        return NextResponse.json(
          {
            answer: "Your vault appears to be empty or the path is not accessible.",
            sources: [],
          },
          { status: 200 }
        );
      }

      // Convert to the notesWithContent format with titles only (no need to read full content)
      notesWithContent = allNotes.map(note => ({
        title: note.title,
        path: note.path,
        content: `[Available note in vault]`,
      }));
    } else {
      // Read full content of search results
      notesWithContent = await Promise.all(
        searchResults.map(async (result) => ({
          ...result,
          content: await readNoteContent(result.path, pathToUse),
        }))
      );
    }

    // Query OpenAI with the notes
    const { answer, sources } = await queryOpenAI(message, notesWithContent);

    return NextResponse.json({ answer, sources }, { status: 200 });
  } catch (error) {
    console.error("Chat API error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    
    return NextResponse.json(
      {
        answer: `Error: ${errorMessage}. Make sure OPENAI_API_KEY is set and mcp-obsidian is installed.`,
        sources: [],
      },
      { status: 200 }
    );
  }
}
