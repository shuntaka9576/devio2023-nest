export type StageName = 'dev' | 'itg' | 'stg' | 'prd';

const DEV_AWS_ACCOUNT_ID = process.env.DEV_AWS_ACCOUNT_ID as string;
const STG_AWS_ACCOUNT_ID = process.env.STG_AWS_ACCOUNT_ID as string;
const PRD_AWS_ACCOUNT_ID = process.env.PRD_AWS_ACCOUNT_ID as string;

export interface Config {
  projectName: string;
  env: {
    stageName: StageName;
    accountId: string;
    imageTag: string;
    webApiCorsDomain: string;
    albCertificateArn: string;
    lineChannelId: string;
    allowIpList: string[];
  };
}

const ALLOW_IP_LIST: string[] = [];

export const getConfig = (stageName: string): Config => {
  if (stageName === 'dev') {
    return {
      projectName: 'devio2023',
      env: {
        stageName: 'dev',
        accountId: DEV_AWS_ACCOUNT_ID,
        imageTag: '2060edb',
        webApiCorsDomain: '*',
        albCertificateArn: '',
        lineChannelId: '',
        allowIpList: ALLOW_IP_LIST,
      },
    };
  } else if (stageName === 'stg') {
    return {
      projectName: 'devio2023',
      env: {
        stageName: 'stg',
        accountId: STG_AWS_ACCOUNT_ID,
        imageTag: '2060edb',
        webApiCorsDomain: '', // TODO
        albCertificateArn: '',
        lineChannelId: '',
        allowIpList: ALLOW_IP_LIST,
      },
    };
  } else if (stageName === 'prd') {
    return {
      projectName: 'devio2023',
      env: {
        stageName: 'prd',
        accountId: PRD_AWS_ACCOUNT_ID,
        imageTag: '0.2.0',
        webApiCorsDomain: '', // TODO
        albCertificateArn: '',
        lineChannelId: '',
        allowIpList: ['0.0.0.0/32'],
      },
    };
  }

  throw new Error('no found environment');
};
