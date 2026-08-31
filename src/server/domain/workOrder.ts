import { ActorContext, DomainResult, FleetDomainError, WorkOrder, WorkOrderStatus, assertOrganization, audit } from './fleet';

const allowed: Readonly<Record<WorkOrderStatus, readonly WorkOrderStatus[]>> = {
  intake: ['inspection_pending', 'cancelled'],
  inspection_pending: ['inspection_complete', 'cancelled'],
  inspection_complete: ['authorization_pending', 'cancelled'],
  authorization_pending: ['authorized', 'cancelled'],
  authorized: ['service_in_progress', 'cancelled'],
  service_in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export interface WorkOrderTransitionInput {
  inspectionId?: string;
  authorizationId?: string;
}

export function transitionWorkOrder(
  workOrder: WorkOrder,
  to: WorkOrderStatus,
  input: WorkOrderTransitionInput,
  context: ActorContext,
): DomainResult<WorkOrder> {
  assertOrganization(context.organizationId, workOrder.organizationId);
  if (!allowed[workOrder.status].includes(to)) {
    throw new FleetDomainError('INVALID_WORK_ORDER_TRANSITION', `Cannot transition work order from ${workOrder.status} to ${to}`);
  }
  const inspectionId = input.inspectionId ?? workOrder.inspectionId;
  const authorizationId = input.authorizationId ?? workOrder.authorizationId;
  if (to === 'inspection_complete' && !inspectionId) throw new FleetDomainError('INSPECTION_REQUIRED', 'A completed inspection is required');
  if (to === 'authorized' && !authorizationId) throw new FleetDomainError('AUTHORIZATION_REQUIRED', 'Customer authorization is required');
  if (to === 'service_in_progress' && !workOrder.lines.some((line) => line.authorized)) {
    throw new FleetDomainError('AUTHORIZED_WORK_REQUIRED', 'At least one authorized work line is required');
  }
  const value: WorkOrder = {
    ...workOrder,
    inspectionId,
    authorizationId,
    status: to,
    completedAt: to === 'completed' ? context.now : workOrder.completedAt,
  };
  return { value, events: [audit(context, 'work_order', value.id, `work_order.${to}`, { from: workOrder.status, to })] };
}
