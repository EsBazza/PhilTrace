import { NextRequest } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import type { Prisma } from '@prisma/client';

const SYSTEM_PROMPT = `You are PhilTrace AI, a civic transparency assistant for Philippine public infrastructure. You must use the provided tools to query the database. After retrieving data, answer ONLY using the project data provided. If the answer cannot be found, say: 'I do not have that information in the current database.' Never state amounts, names, contractor details, project statuses, or any facts that are not explicitly present in the data. Always include project IDs in your answers so users can click through to the full record.`;

const tools = [{
  functionDeclarations: [
    {
      name: 'searchProjects',
      description: 'Search for infrastructure projects by region, province, contractor, category, and flags.',
      parameters: {
        type: 'OBJECT',
        properties: {
          region: { type: 'STRING' },
          province: { type: 'STRING' },
          contractor: { type: 'STRING' },
          category: { type: 'STRING' },
          flagType: { type: 'STRING', enum: ['overdue', 'overpaid', 'stalled', 'neverStarted'] },
          status: { type: 'STRING' }
        }
      }
    },
    {
      name: 'getContractorStats',
      description: 'Get statistics about a specific contractor.',
      parameters: {
        type: 'OBJECT',
        properties: {
          contractor: { type: 'STRING' }
        },
        required: ['contractor']
      }
    },
    {
      name: 'getRegionalAnomalies',
      description: 'Get regional anomalies for projects.',
      parameters: {
        type: 'OBJECT',
        properties: {
          region: { type: 'STRING' },
          province: { type: 'STRING' }
        }
      }
    }
  ]
}];

async function executeTool(name: string, args: any) {
  let sourceIds: string[] = [];
  let result: any = null;
  if (name === 'searchProjects') {
    const where: Prisma.ProjectWhereInput = {};
    if (args.flagType === 'overdue') where.flagOverdue = true;
    if (args.flagType === 'overpaid') where.flagOverpaid = true;
    if (args.flagType === 'stalled') where.flagStalled = true;
    if (args.flagType === 'neverStarted') where.flagNeverStarted = true;
    if (args.category) where.category = { contains: args.category, mode: 'insensitive' };
    if (args.status) where.status = args.status;
    if (args.contractor) where.contractorRaw = { contains: args.contractor, mode: 'insensitive' };
    
    if (args.province) {
      const provinces = await prisma.province.findMany({ where: { name: { contains: args.province, mode: 'insensitive' } } });
      if (provinces.length > 0) where.provinceId = { in: provinces.map(p => p.id) };
    } else if (args.region) {
      const regions = await prisma.region.findMany({ where: { name: { contains: args.region, mode: 'insensitive' } } });
      if (regions.length > 0) {
        const provinces = await prisma.province.findMany({ where: { regionId: { in: regions.map(r => r.id) } } });
        where.provinceId = { in: provinces.map(p => p.id) };
      }
    }
    const projects = await prisma.project.findMany({ where, take: 20 });
    sourceIds = projects.map(p => p.id);
    result = { projects };
  } else if (name === 'getContractorStats') {
    const projects = await prisma.project.findMany({ where: { contractorRaw: { contains: args.contractor, mode: 'insensitive' } } });
    sourceIds = projects.map(p => p.id).slice(0, 10);
    result = {
      totalProjects: projects.length,
      totalBudget: projects.reduce((acc, p) => acc + (p.budgetPHP || 0), 0),
      flagged: projects.filter(p => p.flagOverdue || p.flagOverpaid || p.flagStalled || p.flagNeverStarted).length
    };
  } else if (name === 'getRegionalAnomalies') {
    const where: Prisma.ProjectWhereInput = { OR: [{ flagStalled: true }, { flagOverdue: true }, { flagOverpaid: true }, { flagNeverStarted: true }] };
    if (args.province) {
      const provinces = await prisma.province.findMany({ where: { name: { contains: args.province, mode: 'insensitive' } } });
      if (provinces.length > 0) where.provinceId = { in: provinces.map(p => p.id) };
    } else if (args.region) {
      const regions = await prisma.region.findMany({ where: { name: { contains: args.region, mode: 'insensitive' } } });
      if (regions.length > 0) {
        const provinces = await prisma.province.findMany({ where: { regionId: { in: regions.map(r => r.id) } } });
        where.provinceId = { in: provinces.map(p => p.id) };
      }
    }
    const projects = await prisma.project.findMany({ where, take: 20 });
    sourceIds = projects.map(p => p.id);
    result = { anomalyCount: projects.length, projects: projects.map(p => ({id: p.id, name: p.name})) };
  }
  return { result, sourceIds };
}

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json() as { message: string };
    if (!message) return Response.json({ error: 'message is required' }, { status: 400 });

    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY() });
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: SYSTEM_PROMPT,
        tools: tools as any,
        temperature: 0,
      }
    });

    const response = await chat.sendMessage({ message });
    
    let sourceIds: string[] = [];
    if (response.functionCalls && response.functionCalls.length > 0) {
      const call = response.functionCalls[0];
      const toolRes = await executeTool(call.name as string, call.args);
      sourceIds = toolRes.sourceIds;
      
      const stream = await chat.sendMessageStream({
        message: [{
          functionResponse: {
            name: call.name as string,
            response: toolRes.result
          }
        }] as any
      });
      
      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            if (sourceIds.length > 0) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ sourceIds })}\n\n`));
            }
            for await (const chunk of stream) {
              const text = chunk.text ?? '';
              if (text) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch (err) {
            controller.error(err);
          }
        },
      });

      return new Response(readableStream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } });
    } else {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: response.text })}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      });
      return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } });
    }
  } catch (error) {
    console.error('Error in chat:', error);
    return Response.json({ error: 'Failed to process chat message' }, { status: 500 });
  }
}
