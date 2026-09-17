import test from 'node:test';
import assert from 'node:assert/strict';
import {validateConfig} from '../js/supabase-client.js';
test('configuração futura recusa credenciais secretas e URLs inseguras',()=>{
  const settings={supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'sb_publishable_example'};
  assert.equal(validateConfig(settings),'https://example.supabase.co');
  for(const key of ['', 'sb_secret_example', 'invalid'])assert.throws(()=>validateConfig({...settings,supabasePublishableKey:key}));
  const secretJwt='e30.'+btoa(JSON.stringify({role:'service_role'}))+'.signature';
  assert.throws(()=>validateConfig({...settings,supabasePublishableKey:secretJwt}));
  assert.throws(()=>validateConfig({...settings,supabaseUrl:'http://example.supabase.co'}));
});
