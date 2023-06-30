import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';
import { pascalCase } from 'pascal-case';
import { Config, getConfig } from './config';

export class BackendEcrStack extends cdk.Stack {
  public sandboxRegistry: ecr.IRepository;
  public releaseRegistry: ecr.IRepository;
  private config: Config;
  private namePrefix: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const stageName = this.node.tryGetContext('stageName');
    this.config = getConfig(stageName);
    this.namePrefix = `${stageName}-${this.config.projectName}`;

    this.createSandboxEcr();
    this.createReleaseEcr();
  }

  createSandboxEcr() {
    const sandboxRegistryName = `${this.config.projectName}-web-api-sandbox`;
    const region = cdk.Stack.of(this).region;

    if (this.config.env.stageName === 'dev') {
      const sandboxRegistry = new ecr.Repository(
        this,
        `${pascalCase(this.namePrefix)}EcrRegistry`,
        {
          repositoryName: sandboxRegistryName,
          imageTagMutability: ecr.TagMutability.IMMUTABLE,
        },
      );
      sandboxRegistry.addLifecycleRule({ maxImageCount: 10 });

      this.sandboxRegistry = sandboxRegistry;
    } else if (this.config.env.stageName === 'stg') {
      this.sandboxRegistry = ecr.Repository.fromRepositoryName(
        this,
        `${pascalCase(this.namePrefix)}EcrRegistry`,
        sandboxRegistryName,
      );
    }

    if (this.config.env.stageName === 'dev') {
      new ecr.CfnReplicationConfiguration(
        this,
        `${pascalCase(this.namePrefix)}ReplicaConfig`,
        {
          replicationConfiguration: {
            rules: [
              {
                destinations: [
                  {
                    region: region,
                    registryId: getConfig('stg').env.accountId,
                  },
                ],
                repositoryFilters: [
                  {
                    filter: sandboxRegistryName,
                    filterType: 'PREFIX_MATCH',
                  },
                ],
              },
            ],
          },
        },
      );
    }

    if (this.config.env.stageName === 'stg') {
      new ecr.CfnRegistryPolicy(
        this,
        `${pascalCase(this.namePrefix)}EcrRegistryPolicy`,
        {
          policyText: {
            Version: '2012-10-17',
            Statement: [
              {
                Sid: '',
                Effect: 'Allow',
                Principal: {
                  AWS: `arn:aws:iam::${getConfig('dev').env.accountId}:root`,
                },
                Action: ['ecr:CreateRepository', 'ecr:ReplicateImage'],
                Resource: `arn:aws:ecr:ap-northeast-1:${
                  getConfig('stg').env.accountId
                }:repository/*`,
              },
            ],
          },
        },
      );
    }
  }

  createReleaseEcr() {
    const releaseRegistryName = `${this.config.projectName}-web-api-release`;
    const region = cdk.Stack.of(this).region;

    if (this.config.env.stageName === 'stg') {
      const releaseRegistry = new ecr.Repository(
        this,
        `${this.config.env.stageName}ReleaseEcrRegistry`,
        {
          repositoryName: releaseRegistryName,
          imageTagMutability: ecr.TagMutability.IMMUTABLE,
        },
      );
      releaseRegistry.addLifecycleRule({ maxImageCount: 10 });

      this.releaseRegistry = releaseRegistry;
    } else {
      this.releaseRegistry = ecr.Repository.fromRepositoryName(
        this,
        `${this.config.env.stageName}ReleaseEcrRegistry`,
        releaseRegistryName,
      );
    }

    if (this.config.env.stageName === 'stg') {
      new ecr.CfnReplicationConfiguration(
        this,
        `${pascalCase(this.namePrefix)}ReplicaConfig`,
        {
          replicationConfiguration: {
            rules: [
              {
                destinations: [
                  {
                    region: region,
                    registryId: getConfig('prd').env.accountId,
                  },
                ],
                repositoryFilters: [
                  {
                    filter: releaseRegistryName,
                    filterType: 'PREFIX_MATCH',
                  },
                ],
              },
            ],
          },
        },
      );
    }

    if (this.config.env.stageName === 'prd') {
      new ecr.CfnRegistryPolicy(
        this,
        `${pascalCase(this.namePrefix)}EcrRegistryPolicy`,
        {
          policyText: {
            Version: '2012-10-17',
            Statement: [
              {
                Sid: '',
                Effect: 'Allow',
                Principal: {
                  AWS: `arn:aws:iam::${getConfig('stg').env.accountId}:root`,
                },
                Action: ['ecr:CreateRepository', 'ecr:ReplicateImage'],
                Resource: `arn:aws:ecr:ap-northeast-1:${
                  getConfig('prd').env.accountId
                }:repository/*`,
              },
            ],
          },
        },
      );
    }
  }
}
