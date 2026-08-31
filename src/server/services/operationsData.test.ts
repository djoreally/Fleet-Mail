import { describe, expect, it } from 'vitest';
import { normalizeCustomerInput, normalizePartInput } from './operationsData';

describe('operations data validation',()=>{
  it('normalizes tenant customer input',()=>expect(normalizeCustomerInput({name:' Acme ',billingEmail:' ops@acme.test '})).toMatchObject({name:'Acme',billingEmail:'ops@acme.test',status:'active'}));
  it('normalizes inventory quantities and SKU',()=>expect(normalizePartInput({sku:' flt-1 ',name:' Filter ',quantity:'4',reorderPoint:2})).toMatchObject({sku:'FLT-1',name:'Filter',quantity:4,reorderPoint:2}));
  it('rejects invalid numeric inventory values',()=>expect(()=>normalizePartInput({sku:'A',name:'Part',quantity:-1})).toThrow(/zero or greater/));
});
