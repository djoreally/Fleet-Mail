import express, { type NextFunction, type Request, type Response } from 'express';
import { apiRouter } from './routes/api.js';
import { googleRouter } from './routes/google.js';
import { agentmailCrudRouter } from './routes/agentmailCrud.js';
import { agentMailAttachmentsRouter } from './routes/agentMailAttachments.js';
import { agentActionsRouter } from './routes/agentActions.js';
import { agentObservabilityRouter } from './routes/agentObservability.js';
import { operationsRouter } from './routes/operations.js';
import { customerPartsRouter } from './routes/customerParts.js';
import { fleetServiceRouter } from './routes/fleetService.js';
import { scheduleDispatchRouter } from './routes/scheduleDispatch.js';
import { financialDocumentsRouter } from './routes/financialDocuments.js';
import { financialReadModelRouter } from './routes/financialReadModel.js';
import { paymentReconciliationRouter } from './routes/paymentReconciliation.js';
import { vehicle360Router } from './routes/vehicle360.js';
import { vehicleManagementRouter } from './routes/vehicleManagement.js';
import { workOrderExecutionRouter } from './routes/workOrderExecution.js';
import { workOrderCompletionRouter } from './routes/workOrderCompletion.js';
import { maintenanceIntelligenceRouter } from './routes/maintenanceIntelligence.js';
import { prospectManagementRouter } from './routes/prospectManagement.js';
import { prospectingRouter } from './routes/prospecting.js';
import { technicianRouter } from './routes/technician.js';
import { dispatcherRouter } from './routes/dispatcher.js';
import { tenantChatRouter } from './routes/chat.js';
import { dashboardRouter } from './routes/dashboard.js';
import { teamRouter } from './routes/team.js';
import { prospectWebhookService, verifyAgentMailWebhook } from './services/prospectWebhook.js';
import { fleetAgentRuntimeMiddleware } from './services/fleetAgentRuntime.js';
import { chatAttachmentExtractionMiddleware } from './services/chatAttachmentExtraction.js';
import { fleetMutationLedgerMiddleware } from './services/fleetMutationLedger.js';
import { fleetAuthFailure, getFleetAccessContext, requireFleetOrganization } from './services/fleetAuth.js';
import { enforceAgentMailInboxScope, resolveOrganizationAgentMailInbox } from './services/agentMailTenantBoundary.js';
import { serverConfig } from './config.js';

async function requireFleetSession(req: Request, res: Response, next: NextFunction) { try { await requireFleetOrganization(req); return next(); } catch (error) { return fleetAuthFailure(res, error); } }
function disabledDatabaseControlPlane(_req: Request, res: Response) { return res.status(404).json({ error: 'Not found' }); }
export function createApp() {
  const app = express();
  app.post('/api/webhooks/agentmail', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => { const raw=Buffer.isBuffer(req.body)?req.body:Buffer.from('');const secret=process.env.AGENTMAIL_WEBHOOK_SECRET?.trim()||'';if(!secret||!verifyAgentMailWebhook(raw,req.headers as Record<string,unknown>,secret))return res.status(401).json({error:'invalid_signature'});try{const payload=JSON.parse(raw.toString('utf8'));const result=await prospectWebhookService.handle(payload);return res.status(200).json({accepted:true,...result})}catch(error){console.error('AgentMail webhook processing failed',error instanceof Error?error.message:error);return res.status(500).json({error:'webhook_processing_failed'})}});
  const jsonParser=express.json({ limit: '10mb' });
  const urlencodedParser=express.urlencoded({extended:true});
  app.use((req,res,next)=>{
    let preParsedBody:unknown;
    try{preParsedBody=req.body;}catch{return res.status(400).json({error:'invalid_request_body'});}
    if(preParsedBody!==undefined&&preParsedBody!==null)return next();
    return jsonParser(req,res,error=>error?next(error):urlencodedParser(req,res,next));
  });
  app.use(fleetMutationLedgerMiddleware);
  app.get('/api/status',async(req,res)=>{const atlasKey=process.env.ATLASCLOUD_API_KEY;const agentKey=process.env.AGENTMAIL_API_KEY;const status:Record<string,unknown>={atlasCloudConfigured:Boolean(atlasKey&&atlasKey!=='your-atlascloud-api-key'&&atlasKey.trim()!==''),agentMailConfigured:Boolean(agentKey&&agentKey!=='your-agentmail-api-key'&&agentKey.trim()!==''),neonConfigured:Boolean(serverConfig.neonDataApiUrl&&serverConfig.neonAuthUrl),googleConfigured:Boolean(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET&&process.env.GOOGLE_TOKEN_ENCRYPTION_KEY),firecrawlConfigured:Boolean(process.env.FIRECRAWL_API_KEY?.trim()),browserbaseConfigured:Boolean(process.env.BROWSERBASE_API_KEY?.trim())};if(req.header('authorization')?.startsWith('Bearer ')){try{const activeInbox=await resolveOrganizationAgentMailInbox(req);status.defaultInbox=activeInbox;status.activeInbox=activeInbox}catch{}}return res.json(status)});
  app.get('/api/access',requireFleetSession,async(req,res)=>{try{return res.json(await getFleetAccessContext(req))}catch(error){return fleetAuthFailure(res,error)}});
  app.use('/api/neon',disabledDatabaseControlPlane);app.use('/api/drizzle',disabledDatabaseControlPlane);
  app.use('/api/vehicles',requireFleetSession);app.use('/api/contacts',requireFleetSession);app.use('/api/agent',requireFleetSession);app.use('/api/team',requireFleetSession);app.use('/api/technician',requireFleetSession);app.use('/api/dispatcher',requireFleetSession);app.use('/api/fleet-service',requireFleetSession);
  app.use('/api/chat',requireFleetSession);app.use('/api/chat',enforceAgentMailInboxScope);app.use('/api/rewrite-tone',requireFleetSession);app.use('/api/generate-draft',requireFleetSession);app.use('/api/summarize-email',requireFleetSession);app.use('/api/agentmail',requireFleetSession);app.use('/api/agentmail',enforceAgentMailInboxScope);
  app.use('/api/chat',chatAttachmentExtractionMiddleware);app.use('/api/chat',fleetAgentRuntimeMiddleware);app.use('/api/chat',tenantChatRouter);app.use('/api/chat',(req,res)=>req.method==='POST'?res.status(410).json({error:'Legacy chat route is disabled'}):res.status(404).end());
  app.use('/api',dashboardRouter);app.use('/api',agentMailAttachmentsRouter);app.use('/api',vehicleManagementRouter);app.use('/api',apiRouter);app.use('/api',vehicle360Router);app.use('/api/google',googleRouter);app.use('/api/team',teamRouter);app.use('/api/technician',technicianRouter);app.use('/api/dispatcher',dispatcherRouter);app.use('/api/agentmail/crud',agentmailCrudRouter);app.use('/api/agent',agentObservabilityRouter);app.use('/api/agent/actions',agentActionsRouter);app.use('/api/operations',operationsRouter);app.use('/api/operations',customerPartsRouter);app.use('/api/operations',maintenanceIntelligenceRouter);app.use('/api/operations',workOrderCompletionRouter);app.use('/api/operations',workOrderExecutionRouter);app.use('/api/operations',prospectManagementRouter);app.use('/api/operations',prospectingRouter);app.use('/api/fleet-service',fleetServiceRouter);app.use('/api/fleet-operations',scheduleDispatchRouter);app.use('/api/fleet',paymentReconciliationRouter);app.use('/api/fleet',financialReadModelRouter);app.use('/api/fleet',financialDocumentsRouter);return app;
}
