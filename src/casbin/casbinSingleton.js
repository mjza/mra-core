const { newEnforcer } = require('casbin');
const TypeORMAdapter = require('typeorm-adapter').default;
const { checkOwnership } = require('./casbinOwnership');
const { checkRelationship } = require('./casbinRelationship');
const {  deletePoliciesForDomainZero, importPoliciesFromCSV, addRoleForUserInDomain } = require('./casbinRoleManagement');

async function initCasbin() {
  const adapter = await TypeORMAdapter.newAdapter({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  const enforcer = await newEnforcer('./config/model.conf', adapter);

  await deletePoliciesForDomainZero(enforcer);

  const csvFilePath = './config/policy.csv';
  await importPoliciesFromCSV(enforcer, csvFilePath);
  
  // Add custom functions to Casbin's function map
  enforcer.addFunction('checkOwnership', checkOwnership);
  enforcer.addFunction('checkRelationship', checkRelationship);

  await addRoleForUserInDomain(enforcer, 'username1', 'superdata', '0'); // TODO remove it.
  
  return enforcer;
}

let enforcerPromiseInstance;

async function setupCasbinMiddleware() {
  if (!enforcerPromiseInstance) {
    enforcerPromiseInstance = (async () => {
      return await initCasbin();
    })();
  }
}

function casbinMiddleware(req, res, next) {
  if (!enforcerInstance) {
    console.error('Casbin enforcer is not initialized. Call setupCasbinMiddleware before using this method.');
    return res.status(500).send('Internal Server Error');
  }

  enforcerPromiseInstance.then(enforcer => {
    req.enforcer = enforcer;
    next();
  }).catch(next);
}

module.exports = { setupCasbinMiddleware, casbinMiddleware };