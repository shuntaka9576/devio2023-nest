import * as cdk from 'aws-cdk-lib';
import { BackendEcrStack } from '../lib/backend-ecr-stack';
import { BackendStack } from '../lib/backend-stack';
import { getConfig, StageName } from '../lib/config';
import { NetworkStack } from '../lib/network-stack';

const app = new cdk.App();

const stageName: StageName = app.node.tryGetContext('stageName');
const config = getConfig(stageName);
const namePrefix = `${stageName}-${config.projectName}`;

const network = new NetworkStack(app, `${namePrefix}-network`, {
  env: {
    region: 'ap-northeast-1',
  },
  crossRegionReferences: true,
});

const backendEcr = new BackendEcrStack(app, `${namePrefix}-backend-ecr`, {
  env: {
    region: 'ap-northeast-1',
  },
});

new BackendStack(app, `${namePrefix}-backend`, {
  vpc: network.vpc,
  ecrRepository: backendEcr.sandboxRegistry,
  securityGroupForBastion: network.bastionHostSG,
  env: {
    region: 'ap-northeast-1',
  },
});
