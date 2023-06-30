import Axios from 'axios';
import {
  LineApiVerifyAccessTokenExpiredError,
  LineApiVerifyAccessTokenInvalidClientIdError,
} from './errors/api-error';

const LINE_API_BASE_URL = 'https://api.line.me/oauth2/v2.1';
const LINE_CHANNEL_ID = process.env.LINE_CHANNEL_ID;

interface VerifyAccessTokenApiResponse {
  client_id: string;
  expires_in: number;
  scope: string;
}

interface GetUserInfoApiResponse {
  sub: string;
}

/**
 * LINEのアクセストークンを検証
 * レスポンスが取得できれば、検証OK。それ以外は実行時例外
 * @param accessToken LINEのアクセストークン
 */
export const verifyAccessToken = async (
  accessToken: string,
): Promise<VerifyAccessTokenApiResponse> => {
  const res = await Axios.request<VerifyAccessTokenApiResponse>({
    method: 'get',
    url: `${LINE_API_BASE_URL}/verify?access_token=${accessToken}`,
  });

  if (res.data.client_id !== LINE_CHANNEL_ID) {
    throw new LineApiVerifyAccessTokenInvalidClientIdError(accessToken, res);
  }

  if (
    res.data.expires_in < 0 // LINEアクセストークン推奨検証事項
  ) {
    throw new LineApiVerifyAccessTokenExpiredError(accessToken, res);
  }

  return res.data;
};

export const getUserInfo = async (
  accessToken: string,
): Promise<GetUserInfoApiResponse> => {
  const res = await Axios.request<GetUserInfoApiResponse>({
    method: 'get',
    url: `${LINE_API_BASE_URL}/userinfo`,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return res.data;
};
