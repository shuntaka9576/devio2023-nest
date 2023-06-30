import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { CfnRoute, CfnRouteTable } from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { pascalCase } from 'pascal-case';
import { getConfig } from './config';

export class NetworkStack extends cdk.Stack {
  readonly vpc: ec2.Vpc;
  readonly bastionHostSG: ec2.SecurityGroup;
  private namePrefix: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const stageName = this.node.tryGetContext('stageName');
    const config = getConfig(stageName);
    this.namePrefix = `${stageName}-${config.projectName}`;

    this.vpc = new ec2.Vpc(this, `${pascalCase(this.namePrefix)}Vpc`, {
      vpcName: `${this.namePrefix}-vpc`,
      cidr: '10.0.0.0/16',
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: `public`,
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: `private`,
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // VPCフローログ用バケット
    const vpcFlowLogBucket = new s3.Bucket(
      this,
      `${pascalCase(this.namePrefix)}VpcFlowLogBucket`,
      {
        bucketName: `aws-vpc-flow-logs-${stageName}-${this.account}`,
        encryption: s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
      },
    );
    this.vpc.addFlowLog(`${pascalCase(this.namePrefix)}FlowLogS3`, {
      destination: ec2.FlowLogDestination.toS3(vpcFlowLogBucket),
    });

    const publicRouteTable = new CfnRouteTable(
      this,
      `${pascalCase(this.namePrefix)}PublicRouteTable`,
      {
        vpcId: this.vpc.vpcId,
      },
    );

    // PublicのFargateがネットワークに抜けられるように
    new CfnRoute(this, `${pascalCase(this.namePrefix)}IgwRoute`, {
      routeTableId: publicRouteTable.ref,
      destinationCidrBlock: '0.0.0.0/0',
      gatewayId: this.vpc.internetGatewayId,
    });

    // 踏み台+セッションマネージャー設定
    const bastionHostSG = new ec2.SecurityGroup(
      this,
      `${pascalCase(this.namePrefix)}BastionHostSecurityGroup`,
      {
        vpc: this.vpc,
        securityGroupName: `${this.namePrefix}-bastion-host`,
        allowAllOutbound: true,
      },
    );
    this.bastionHostSG = bastionHostSG;

    new ec2.BastionHostLinux(
      this,
      `${pascalCase(this.namePrefix)}BastionHost`,
      {
        instanceName: `${this.namePrefix}-bastion-for-private-resources`,
        vpc: this.vpc,
        subnetSelection: {
          subnetGroupName: 'private',
        },
        securityGroup: bastionHostSG,
      },
    );

    // セッションマネージャーから接続するためのVPCエンドポイントの構成
    this.vpc.addInterfaceEndpoint(`${pascalCase(this.namePrefix)}SsmEndpoint`, {
      service: ec2.InterfaceVpcEndpointAwsService.SSM,
    });
    this.vpc.addInterfaceEndpoint(
      `${pascalCase(this.namePrefix)}SsmMessagesEndpoint`,
      {
        service: ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES,
      },
    );
    this.vpc.addInterfaceEndpoint(
      `${pascalCase(this.namePrefix)}Ec2MessagesEndpoint`,
      {
        service: ec2.InterfaceVpcEndpointAwsService.EC2_MESSAGES,
      },
    );
  }
}
