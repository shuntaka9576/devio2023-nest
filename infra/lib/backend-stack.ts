import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elb from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as awsBackup from 'aws-cdk-lib/aws-backup';
import { Schedule } from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';
import { pascalCase } from 'pascal-case';
import { getConfig } from './config';
import { RemovalPolicy } from 'aws-cdk-lib';
import { ObjectOwnership } from 'aws-cdk-lib/aws-s3';

const DB_ADMIN_USER_NAME = 'devio2023';
const DB_APP_USER_NAME = 'devio2023app';
const DATABASE_NAME = 'devio2023db';

type Props = {
  vpc: ec2.Vpc;
  ecrRepository: ecr.IRepository;
  securityGroupForBastion: ec2.SecurityGroup;
} & cdk.StackProps;

export class BackendStack extends cdk.Stack {
  private namePrefix: string;
  private stageName: string;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);
    this.stageName = this.node.tryGetContext('stageName');
    const config = getConfig(this.stageName);
    this.namePrefix = `${this.stageName}-${config.projectName}`;

    const albResources = this.createAlbResources({
      vpc: props.vpc,
      certificateArn: config.env.albCertificateArn,
      albAllowIpList: config.env.allowIpList,
      corsDomain: config.env.webApiCorsDomain,
    });
    const secret = new secretsmanager.Secret(this, 'DBSecret', {
      secretName: `${this.namePrefix}-aurora-secret`,
      generateSecretString: {
        excludePunctuation: true,
        includeSpace: false,
        generateStringKey: 'password',
        secretStringTemplate: JSON.stringify({
          username: DB_ADMIN_USER_NAME,
        }),
      },
    });

    const secretForApp = new secretsmanager.Secret(this, `DBSecretForApp`, {
      secretName: `${this.namePrefix}-aurora-secret-for-app`,
      generateSecretString: {
        excludePunctuation: true,
        includeSpace: false,
        generateStringKey: 'password',
        secretStringTemplate: JSON.stringify({
          username: DB_APP_USER_NAME,
        }),
      },
    });

    const securityGroupForFargate = new ec2.SecurityGroup(
      this,
      `${pascalCase(this.namePrefix)}FargateSecurityGroup`,
      {
        securityGroupName: `${this.namePrefix}-fargate`,
        vpc: props.vpc,
        allowAllOutbound: false,
      },
    );

    // FargateのセキュリティグループにALBヘルスチェック用のポートを開ける
    securityGroupForFargate.addIngressRule(
      albResources.securityGroup,
      ec2.Port.tcp(80),
    );
    // OutboundはHTTPSのみ許可する。接続先はLINEと各種AWSのエンドポイント。Auroraへの接続設定は別途行う
    securityGroupForFargate.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
    );

    this.createAuroraServelessV2({
      vpc: props.vpc,
      securityGroupForFargate: securityGroupForFargate,
      securityGroupForBastion: props.securityGroupForBastion,
      dbSecret: secret,
    });

    const fargateService = this.createFargateService({
      vpc: props.vpc,
      ecrRepository: props.ecrRepository,
      securityGroupForAlb: albResources.securityGroup,
      securityGroupForFargate: securityGroupForFargate,
      corsDomain: config.env.webApiCorsDomain,
      imageTag: config.env.imageTag,
      dbSecret: secret,
      dbSecretForApp: secretForApp,
      lineChannelId: config.env.lineChannelId,
      // imageCdnDomain: config.env.imageCdnPath,
    });

    const albTargetGroup = albResources.lister.addTargets(
      `${pascalCase(this.namePrefix)}AlbTargetGroup`,
      {
        port: 80,
        targets: [fargateService.service],
        healthCheck: {
          enabled: true,
          path: '/health-check',
          healthyHttpCodes: '204',
        },
      },
    );
    albTargetGroup.setAttribute('deregistration_delay.timeout_seconds', '30');
    albTargetGroup.setAttribute(
      'load_balancing.algorithm.type',
      'least_outstanding_requests',
    );
  }

  private createFargateService(props: {
    vpc: ec2.Vpc;
    ecrRepository: ecr.IRepository;
    securityGroupForAlb: ec2.SecurityGroup;
    securityGroupForFargate: ec2.SecurityGroup;
    imageTag: string;
    lineChannelId: string;
    dbSecret: secretsmanager.Secret;
    dbSecretForApp: secretsmanager.Secret;
    // imageCdnDomain: string;
    corsDomain: string;
  }): { service: ecs.FargateService } {
    const serviceTaskDefinition = new ecs.FargateTaskDefinition(
      this,
      `${pascalCase(this.namePrefix)}ServiceTaskDefinition`,
      {
        family: `${pascalCase(this.namePrefix)}TaskDefinition`,
        cpu: 2048,
        memoryLimitMiB: 8192,
        taskRole: new iam.Role(
          this,
          `${pascalCase(this.namePrefix)}EcsServiceTaskRole`,
          {
            assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
            managedPolicies: [
              iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMFullAccess'),
            ],
          },
        ),
      },
    );

    serviceTaskDefinition
      .addContainer(
        `${pascalCase(this.namePrefix)}ServiceTaskContainerDefinition`,
        {
          image: ecs.ContainerImage.fromEcrRepository(
            props.ecrRepository,
            props.imageTag,
          ),
          secrets: {
            DB_HOST: ecs.Secret.fromSecretsManager(props.dbSecret, 'host'),
            DB_DBNAME: ecs.Secret.fromSecretsManager(props.dbSecret, 'dbname'),
            // ユーザー名とパスワードは、別途手動作成したものを利用
            DB_USERNAME: ecs.Secret.fromSecretsManager(
              props.dbSecretForApp,
              'username',
            ),
            DB_PASSWORD: ecs.Secret.fromSecretsManager(
              props.dbSecretForApp,
              'password',
            ),
          },
          environment: {
            PORT: '80',
            // CDN_URL: `https://${props.imageCdnDomain}`,
            LINE_CHANNEL_ID: props.lineChannelId,
            STAGE_NAME: this.stageName,
            CORS_DOMAIN: props.corsDomain,
            NODE_ENV: 'production',
          },
          logging: ecs.LogDriver.awsLogs({
            streamPrefix: `${this.namePrefix}-fargate-container-log`,
            logGroup: new logs.LogGroup(this, `ServiceLogGroup`, {
              logGroupName: `${this.namePrefix}-fargate-container-log`,
              retention: logs.RetentionDays.ONE_YEAR,
            }),
          }),
          readonlyRootFilesystem: true,
        },
      )
      .addPortMappings({
        containerPort: 80,
        hostPort: 80,
        protocol: ecs.Protocol.TCP,
      });

    const fargateService = new ecs.FargateService(
      this,
      `${pascalCase(this.namePrefix)}FargateService`,
      {
        cluster: new ecs.Cluster(
          this,
          `${pascalCase(this.namePrefix)}EcsCluster`,
          {
            clusterName: `${this.namePrefix}-ecs-cluster`,
            vpc: props.vpc,
            containerInsights: true,
          },
        ),
        vpcSubnets: props.vpc.selectSubnets({
          subnetGroupName: `public`,
        }),
        assignPublicIp: true,
        securityGroups: [props.securityGroupForFargate],
        taskDefinition: serviceTaskDefinition,
        desiredCount: this.stageName === 'prd' ? 2 : 1,
        maxHealthyPercent: 200,
        minHealthyPercent: 50,
      },
    );

    return { service: fargateService };
  }

  private createAlbResources(props: {
    vpc: ec2.Vpc;
    certificateArn?: string;
    albAllowIpList: string[];
    corsDomain: string;
  }): {
    alb: elb.ApplicationLoadBalancer;
    securityGroup: ec2.SecurityGroup;
    lister: elb.ApplicationListener;
  } {
    const securityGroupForALB = new ec2.SecurityGroup(
      this,
      `${pascalCase(this.namePrefix)}ElbSecurityGroup`,
      {
        securityGroupName: `${this.namePrefix}-alb`,
        vpc: props.vpc,
        allowAllOutbound: false,
      },
    );

    props.albAllowIpList.map((address) => {
      securityGroupForALB.addIngressRule(
        ec2.Peer.ipv4(address),
        ec2.Port.tcp(443),
      );
    });

    // Remove the default rule
    // https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-ec2-security-group.html#aws-properties-ec2-security-group--examples--Remove_the_default_rule
    securityGroupForALB.addEgressRule(
      ec2.Peer.ipv4('127.0.0.1/32'),
      ec2.Port.allTcp(),
      'Limits security group egress traffic',
    );

    const loadBalancerName = `${this.namePrefix}-alb-for-fargate`;
    const alb = new elb.ApplicationLoadBalancer(this, `ALB`, {
      loadBalancerName: loadBalancerName,
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: securityGroupForALB,
      vpcSubnets: props.vpc.selectSubnets({
        subnetGroupName: `public`,
      }),
    });

    const albListener = alb.addListener(
      `${pascalCase(this.namePrefix)}AlbListener`,
      {
        port: 443,
        open: false,
        protocol: elb.ApplicationProtocol.HTTP,
        // FIXME: HTTPSの場合
        // protocol: elb.ApplicationProtocol.HTTPS,
        // sslPolicy: elb.SslPolicy.RECOMMENDED_TLS,
        // certificates: [
        //   {
        //     certificateArn: props.certificateArn,
        //   },
        // ],
      },
    );

    const albLogBucket = new s3.Bucket(
      this,
      `${pascalCase(loadBalancerName)}AlbLogBucket`,
      {
        bucketName: `${loadBalancerName}-logs-${this.account}`,
        encryption: s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        lifecycleRules: [
          {
            expiration: cdk.Duration.days(365),
            abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
          },
        ],
      },
    );
    alb.logAccessLogs(albLogBucket);

    // ALB WAF設定
    const wafAcl = new wafv2.CfnWebACL(
      this,
      `${pascalCase(this.namePrefix)}WafAclForBackend`,
      {
        name: `${this.namePrefix}-waf-acl-for-backend`,
        scope: 'REGIONAL',
        defaultAction: {
          allow: {},
        },
        rules: [
          {
            name: 'AWSManagedRulesCommonRuleSet',
            priority: 0,
            overrideAction: {
              count: {},
            },
            statement: {
              managedRuleGroupStatement: {
                vendorName: 'AWS',
                name: 'AWSManagedRulesCommonRuleSet',
              },
            },
            visibilityConfig: {
              sampledRequestsEnabled: true,
              cloudWatchMetricsEnabled: true,
              metricName: 'AWSManagedRulesCommonRuleSet',
            },
          },
        ],
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: 'AclMetrics',
          sampledRequestsEnabled: true,
        },
      },
    );

    new wafv2.CfnWebACLAssociation(
      this,
      `${pascalCase(this.namePrefix)}WafAclAssociationForBackend`,
      {
        resourceArn: alb.loadBalancerArn,
        webAclArn: wafAcl.attrArn,
      },
    );

    const wafLogBucket = new s3.Bucket(
      this,
      `${pascalCase(this.namePrefix)}BackendAppWafLog`,
      {
        bucketName: `aws-waf-logs-${this.stageName}-${this.account}-backend-app-log`,
        removalPolicy: RemovalPolicy.DESTROY,
        encryption: s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        eventBridgeEnabled: true,
        objectOwnership: ObjectOwnership.OBJECT_WRITER,
        lifecycleRules: [
          {
            expiration: cdk.Duration.days(365),
            abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
          },
        ],
      },
    );

    new wafv2.CfnLoggingConfiguration(
      this,
      `${pascalCase(this.namePrefix)}BackendAppWafLogConfiguration`,
      {
        resourceArn: wafAcl.attrArn,
        logDestinationConfigs: [wafLogBucket.bucketArn],
        loggingFilter: {
          DefaultBehavior: 'DROP',
          Filters: [
            {
              Requirement: 'MEETS_ANY',
              Behavior: 'KEEP',
              Conditions: [
                {
                  ActionCondition: {
                    Action: 'COUNT',
                  },
                },
                {
                  ActionCondition: {
                    Action: 'BLOCK',
                  },
                },
                // See https://dev.classmethod.jp/articles/aws-waf-counted-log-filtering
                {
                  ActionCondition: {
                    Action: 'EXCLUDED_AS_COUNT',
                  },
                },
              ],
            },
          ],
        },
      },
    );

    return {
      alb: alb,
      securityGroup: securityGroupForALB,
      lister: albListener,
    };
  }

  private createAuroraServelessV2(props: {
    vpc: ec2.Vpc;
    securityGroupForFargate: ec2.SecurityGroup;
    securityGroupForBastion: ec2.SecurityGroup;
    dbSecret: secretsmanager.Secret;
  }) {
    const instanceIdPrefix = 'InstanceEncrypted';
    const securityGroupForAurora = new ec2.SecurityGroup(
      this,
      `${pascalCase(this.namePrefix)}AuroraSecurityGroup`,
      {
        securityGroupName: `${this.namePrefix}-aurora`,
        vpc: props.vpc,
        allowAllOutbound: false,
      },
    );
    // Remove the default rule
    securityGroupForAurora.addEgressRule(
      ec2.Peer.ipv4('127.0.0.1/32'),
      ec2.Port.allTcp(),
      'Limits security group egress traffic',
    );

    const clusterBaseSetting = {
      credentials: rds.Credentials.fromSecret(props.dbSecret),
      defaultDatabaseName: DATABASE_NAME,
      parameters: {
        autocommit: '0',
        sql_mode: 'TRADITIONAL,NO_AUTO_VALUE_ON_ZERO,ONLY_FULL_GROUP_BY',
        general_log: '1',
        slow_query_log: '1',
        long_query_time: '2',
        character_set_server: 'utf8mb4',
        character_set_client: 'utf8mb4',
        transaction_isolation: 'READ-COMMITTED',
        server_audit_logging: '1',
        server_audit_events: 'CONNECT,QUERY,TABLE',
      },
      storageEncrypted: true,
      instanceProps: {
        vpc: props.vpc,
        vpcSubnets: props.vpc.selectSubnets({ subnetGroupName: 'private' }),
        securityGroups: [securityGroupForAurora],
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.BURSTABLE3,
          ec2.InstanceSize.MEDIUM,
        ),
      },
      cloudwatchLogsExports: ['audit', 'error', 'general', 'slowquery'],
      cloudwatchLogsRetention: logs.RetentionDays.ONE_YEAR,
    };

    const cluster = new rds.DatabaseCluster(
      this,
      `${pascalCase(this.namePrefix)}DatabaseCluster`,
      {
        instances: this.stageName === 'dev' ? 1 : 2,
        clusterIdentifier: `${this.namePrefix}-aurora-cluster-encrypted`,
        engine: rds.DatabaseClusterEngine.auroraMysql({
          version: rds.AuroraMysqlEngineVersion.VER_3_02_1,
        }),
        instanceIdentifierBase: instanceIdPrefix,
        ...clusterBaseSetting,
      },
    );

    cluster.connections.allowFrom(
      props.securityGroupForFargate,
      ec2.Port.tcp(3306),
    );
    cluster.connections.allowFrom(
      props.securityGroupForBastion,
      ec2.Port.tcp(3306),
    );

    const cfnCluster = cluster.node.defaultChild as rds.CfnDBCluster;
    cfnCluster.addPropertyOverride(`ServerlessV2ScalingConfiguration`, {
      MaxCapacity: 5,
      MinCapacity: 0.5,
    });
    cfnCluster.addPropertyDeletionOverride('EngineMode');

    const children = cluster.node.children;
    for (const child of children) {
      if (child.node.id.startsWith(instanceIdPrefix)) {
        (child as rds.CfnDBInstance).dbInstanceClass = 'db.serverless';
      }
    }

    // AWS Backup設定
    const backupVault = new awsBackup.BackupVault(
      this,
      'AppAuroraBackupVault',
      {
        removalPolicy: RemovalPolicy.DESTROY,
      },
    );

    const backupPlan = new awsBackup.BackupPlan(
      this,
      `AppAuroraClusterBackupPlan`,
      {
        backupVault: backupVault,
        backupPlanRules: [
          new awsBackup.BackupPlanRule({
            ruleName: 'DailyBackup',
            scheduleExpression: Schedule.cron({ minute: '0', hour: '17' }), // 17:00 UTC corresponds to 2:00 JST
            startWindow: cdk.Duration.minutes(60), // 開始60以内に開始
            completionWindow: cdk.Duration.minutes(120), // 120以内に終了(下限: startWindow+60分)
            deleteAfter: cdk.Duration.days(30),
          }),
        ],
      },
    );

    backupPlan.addSelection('AppAuroraBackupSelection', {
      resources: [awsBackup.BackupResource.fromRdsDatabaseCluster(cluster)],
    });
  }
}
