import { BaseCollector } from "../config/baseCollector";
import {
  IAMClient,
  ListUsersCommand,
  type ListUsersCommandOutput,
  ListUserPoliciesCommand,
  ListAttachedUserPoliciesCommand,
  GetUserPolicyCommand,
  ListGroupsCommand,
  type ListGroupsCommandOutput,
  ListGroupPoliciesCommand,
  ListGroupsForUserCommand,
  ListAttachedGroupPoliciesCommand,
  GetGroupPolicyCommand,
  ListRolesCommand,
  type ListRolesCommandOutput,
  ListRolePoliciesCommand,
  ListAttachedRolePoliciesCommand,
  ListPoliciesCommand,
  ListAccessKeysCommand,
  type ListAccessKeysCommandOutput,
  GetLoginProfileCommand,
  GetPolicyVersionCommand,
  GetAccountPasswordPolicyCommand,
  GetAccountSummaryCommand,
  type GetAccountSummaryCommandOutput,
  type AttachedPermissionsBoundary,
  IAMClientConfig,
  GetRolePolicyCommand,
} from "@aws-sdk/client-iam";
import {
  BaseRawData,
  CollectorContext,
  CollectorError,
  CollectorResult,
  Provider,
  Tags,
} from "../config/types";
import { awsClientConfig } from "../config/awsClient";

interface AccessKeyData {
  userName?: string;
  accessKeyId?: string;
  status?: "Active" | "Inactive" | "Expired";
  createDate?: Date;
}

interface AttachedPolicy {
  policyName?: string;
  policyArn?: string;
}

interface InlinePolicy {
  policyName: string;
  version?: string;
  sid?: string;
  effect: "Allow" | "Deny";
  principal: Record<string, string[]>;
  action?: string[];
  resource?: string[];
}

interface PolicyDocument {
  version?: string;
  effect: "Allow" | "Deny";
  principal: Record<string, string[]>;
  action?: string[];
  resource?: string[];
}

interface IAMUser {
  userId: string;
  userName?: string;
  arn?: string;
  createDate?: Date;
  permissionsBoundary?: AttachedPermissionsBoundary;
  tags: Tags[];
  accessKeys: AccessKeyData[];
  attachedPolicies: AttachedPolicy[];
  inlinePolicies: InlinePolicy[];
  passwordEnabled: boolean;
  groups: string[];
}

interface IAMRole {
  roleId: string;
  roleName: string;
  arn: string;
  createDate: Date;
  rolePolicies: string[];
  attachedPolicies: AttachedPolicy[];
  inlinePolicies: InlinePolicy[];
  tags: Tags[];
  maxSessionDuration: number;
  assumeRolePolicyDocument: PolicyDocument;
}

interface IAMGroup {
  groupId: string;
  groupName: string;
  arn?: string;
  createDate?: Date;
  attachedPolicies: AttachedPolicy[];
  inlinePolicies: InlinePolicy[];
}

interface IAMPolicy {
  policyId: string;
  policyName: string;
  arn: string;
  defaultVersionId: string;
  isAttachable: boolean;
  attachmentCount: number;
  createDate?: Date;
  updateDate?: Date;
  isDefaultVersion: boolean;
  policyDocument: PolicyDocument;
}

interface IAMAccountSummary {
  users?: number;
  usersQuota?: number;
  groups?: number;
  groupsQuota?: number;
  roles?: number;
  rolesQuota?: number;
  instanceProfiles?: number;
  accountMFAEnabled?: boolean;
  accountAccessKeysPresent?: boolean;
}

interface PasswordPolicy {
  allowUsersToChangePassword?: boolean;
  minimumPasswordLength?: number;
  requireSymbols?: boolean;
  requireUpperCase?: boolean;
  requireLowerCase?: boolean;
  requireNumbers?: boolean;
  expirePassword?: boolean;
  maxPasswordAge?: number;
  passwordReusePrevention?: number;
  hardExpiry?: boolean;
}

interface IAMData extends BaseRawData {
  users: IAMUser[];
  roles: IAMRole[];
  groups: IAMGroup[];
  policies: IAMPolicy[];
  passwordPolicy: PasswordPolicy;
  accountSummary: IAMAccountSummary;
}

export class IAMCollector extends BaseCollector<IAMData> {
  id: string = "iamCollector";
  provider: Provider = "aws" as const;
  private iamClient: IAMClient;

  constructor(awsRegion: string) {
    super();
    this.iamClient = new IAMClient(awsClientConfig<IAMClientConfig>(awsRegion));
  }

  private async getIAMUser(): Promise<IAMUser[]> {
    const usersData: IAMUser[] = [];

    const response: ListUsersCommandOutput = await this.iamClient.send(
      new ListUsersCommand({}),
    );

    if (response.Users) {
      for (const user of response.Users) {
        if (!user.UserName || !user.UserId) continue;
        const userName = user.UserName;

        const accessKeys: AccessKeyData[] = [];
        const keysResponse: ListAccessKeysCommandOutput =
          await this.iamClient.send(
            new ListAccessKeysCommand({ UserName: userName }),
          );
        if (keysResponse.AccessKeyMetadata) {
          for (const key of keysResponse.AccessKeyMetadata) {
            accessKeys.push({
              userName: key.UserName,
              accessKeyId: key.AccessKeyId,
              status: key.Status || "Inactive",
              createDate: key.CreateDate,
            });
          }
        }

        const tags: Tags[] = [];
        user.Tags?.forEach((tag) => {
          tags.push({ key: tag.Key, value: tag.Value });
        });

        const attachedPolicies: AttachedPolicy[] = [];
        const attPolResponse = await this.iamClient.send(
          new ListAttachedUserPoliciesCommand({ UserName: userName }),
        );
        attPolResponse.AttachedPolicies?.forEach((policy) => {
          attachedPolicies.push({
            policyArn: policy.PolicyArn,
            policyName: policy.PolicyName,
          });
        });

        const inlinePolicies: InlinePolicy[] = [];
        const inlPolResponse = await this.iamClient.send(
          new ListUserPoliciesCommand({ UserName: userName }),
        );
        for (const policyName of inlPolResponse.PolicyNames ?? []) {
          const policyData = await this.iamClient.send(
            new GetUserPolicyCommand({
              UserName: userName,
              PolicyName: policyName,
            }),
          );
          if (policyData.PolicyDocument && policyData.PolicyName) {
            const policyDocument = JSON.parse(
              decodeURIComponent(policyData.PolicyDocument),
            );
            const statements = Array.isArray(policyDocument.Statement)
              ? policyDocument.Statement
              : [policyDocument.Statement];

            for (const stmt of statements) {
              inlinePolicies.push({
                policyName: policyName,
                version: policyDocument.Version,
                sid: stmt.Sid,
                effect: stmt.Effect as "Allow" | "Deny",
                principal: stmt.Principal || undefined,
                action: Array.isArray(stmt.Action)
                  ? stmt.Action
                  : stmt.Action
                    ? [stmt.Action]
                    : undefined,
                resource: Array.isArray(stmt.Resource)
                  ? stmt.Resource
                  : stmt.Resource
                    ? [stmt.Resource]
                    : undefined,
              });
            }
          }
        }

        const passResponse = await this.iamClient.send(
          new GetLoginProfileCommand({ UserName: userName }),
        );
        const passwordEnabled = passResponse.LoginProfile ? true : false;

        const groups: string[] = [];
        const groupResponse = await this.iamClient.send(
          new ListGroupsForUserCommand({ UserName: userName }),
        );
        groupResponse.Groups?.forEach((group) => {
          if (group.GroupId) {
            groups.push(group.GroupId);
          }
        });

        usersData.push({
          userId: user.UserId,
          userName: userName,
          arn: user.Arn,
          createDate: user.CreateDate,
          permissionsBoundary: user.PermissionsBoundary,
          tags: tags,
          accessKeys: accessKeys,
          attachedPolicies: attachedPolicies,
          inlinePolicies: inlinePolicies,
          passwordEnabled: passwordEnabled,
          groups: groups,
        });
      }
    }

    return usersData;
  }

  private async getIAMRoles(): Promise<IAMRole[]> {
    const iamRoles: IAMRole[] = [];

    const response: ListRolesCommandOutput = await this.iamClient.send(
      new ListRolesCommand({}),
    );
    if (response.Roles) {
      for (const role of response.Roles) {
        if (!role.RoleId || !role.RoleName) continue;

        const tags: Tags[] = [];
        role.Tags?.forEach((tag) => {
          tags.push({ key: tag.Key, value: tag.Value });
        });

        const attachedPolicies: AttachedPolicy[] = [];
        const attPolResponse = await this.iamClient.send(
          new ListAttachedRolePoliciesCommand({ RoleName: role.RoleName }),
        );
        attPolResponse.AttachedPolicies?.forEach((policy) => {
          attachedPolicies.push({
            policyArn: policy.PolicyArn,
            policyName: policy.PolicyName,
          });
        });

        const inlinePolicies: InlinePolicy[] = [];
        const inlPolResponse = await this.iamClient.send(
          new ListRolePoliciesCommand({ RoleName: role.RoleName }),
        );

        for (const policyName of inlPolResponse.PolicyNames ?? []) {
          const policyData = await this.iamClient.send(
            new GetRolePolicyCommand({
              RoleName: role.RoleName,
              PolicyName: policyName,
            }),
          );
          if (!policyData.PolicyDocument || !policyData.PolicyName) continue;

          const document = JSON.parse(
            decodeURIComponent(policyData.PolicyDocument),
          );
          const statements = Array.isArray(document.Statement)
            ? document.Statement
            : [document.Statement];

          for (const stmt of statements) {
            inlinePolicies.push({
              policyName: policyName,
              version: document.Version,
              sid: stmt.Sid,
              effect: stmt.Effect as "Allow" | "Deny",
              principal: stmt.Principal || {},
              action: Array.isArray(stmt.Action)
                ? stmt.Action
                : stmt.Action
                  ? [stmt.Action]
                  : undefined,
              resource: Array.isArray(stmt.Resource)
                ? stmt.Resource
                : stmt.Resource
                  ? [stmt.Resource]
                  : undefined,
            });
          }
        }

        const assumeRolePolicyDocument = role.AssumeRolePolicyDocument
          ? JSON.parse(decodeURIComponent(role.AssumeRolePolicyDocument))
          : { effect: "Deny", principal: {} };

        iamRoles.push({
          roleId: role.RoleId,
          roleName: role.RoleName,
          arn: role.Arn,
          createDate: role.CreateDate,
          rolePolicies: inlPolResponse.PolicyNames ?? [],
          attachedPolicies: attachedPolicies,
          inlinePolicies: inlinePolicies,
          tags: tags,
          maxSessionDuration: role.MaxSessionDuration ?? 3600,
          assumeRolePolicyDocument: assumeRolePolicyDocument,
        } as IAMRole);
      }
    }

    return iamRoles;
  }

  private async getIAMGroups(): Promise<IAMGroup[]> {
    const iamGroups: IAMGroup[] = [];

    const response: ListGroupsCommandOutput = await this.iamClient.send(
      new ListGroupsCommand({}),
    );

    if (response.Groups) {
      for (const group of response.Groups) {
        if (!group.GroupId || !group.GroupName) continue;

        const attachedPolicies: AttachedPolicy[] = [];
        const attPolResponse = await this.iamClient.send(
          new ListAttachedGroupPoliciesCommand({ GroupName: group.GroupName }),
        );
        attPolResponse.AttachedPolicies?.forEach((policy) => {
          attachedPolicies.push({
            policyArn: policy.PolicyArn,
            policyName: policy.PolicyName,
          });
        });

        const inlinePolicies: InlinePolicy[] = [];
        const inlPolResponse = await this.iamClient.send(
          new ListGroupPoliciesCommand({ GroupName: group.GroupName }),
        );

        for (const policyName of inlPolResponse.PolicyNames ?? []) {
          const policyData = await this.iamClient.send(
            new GetGroupPolicyCommand({
              GroupName: group.GroupName,
              PolicyName: policyName,
            }),
          );

          if (!policyData.PolicyDocument || !policyData.PolicyName) continue;

          const document = JSON.parse(
            decodeURIComponent(policyData.PolicyDocument),
          );
          const statements = Array.isArray(document.Statement)
            ? document.Statement
            : [document.Statement];

          for (const stmt of statements) {
            inlinePolicies.push({
              policyName: policyName,
              version: document.Version,
              sid: stmt.Sid,
              effect: stmt.Effect as "Allow" | "Deny",
              principal: stmt.Principal || {},
              action: Array.isArray(stmt.Action)
                ? stmt.Action
                : stmt.Action
                  ? [stmt.Action]
                  : undefined,
              resource: Array.isArray(stmt.Resource)
                ? stmt.Resource
                : stmt.Resource
                  ? [stmt.Resource]
                  : undefined,
            });
          }
        }

        iamGroups.push({
          groupId: group.GroupId,
          groupName: group.GroupName,
          arn: group.Arn,
          createDate: group.CreateDate,
          attachedPolicies,
          inlinePolicies,
        });
      }
    }

    return iamGroups;
  }

  private async getPolicies(): Promise<IAMPolicy[]> {
    const policies: IAMPolicy[] = [];

    const response = await this.iamClient.send(
      new ListPoliciesCommand({ Scope: "Local" }),
    );

    if (response.Policies) {
      for (const policy of response.Policies) {
        if (!policy.PolicyId || !policy.Arn || !policy.DefaultVersionId)
          continue;

        const policyVersion = await this.iamClient.send(
          new GetPolicyVersionCommand({
            PolicyArn: policy.Arn,
            VersionId: policy.DefaultVersionId,
          }),
        );

        if (policyVersion.PolicyVersion?.Document) {
          const document = JSON.parse(
            decodeURIComponent(policyVersion.PolicyVersion.Document),
          );
          const statement = document.Statement[0]
          const policyDoc = {
            version: statement.Version,
            effect: statement.Effect as "Allow" | "Deny",
            principal: statement.Principal || {},
            action: Array.isArray(statement.Action)
              ? statement.Action
              : statement.Action
                ? [statement.Action]
                : undefined,
            resource: Array.isArray(statement.Resource)
              ? statement.Resource
              : statement.Resource
                ? [statement.Resource]
                : undefined,
          } as PolicyDocument;

          policies.push({
            policyId: policy.PolicyId,
            policyName: policy.PolicyName!,
            arn: policy.Arn,
            defaultVersionId: policy.DefaultVersionId,
            isAttachable: policy.IsAttachable ?? false,
            attachmentCount: policy.AttachmentCount ?? 0,
            createDate: policy.CreateDate,
            updateDate: policy.UpdateDate,
            isDefaultVersion:
              policyVersion.PolicyVersion.IsDefaultVersion ?? false,
            policyDocument: policyDoc,
          });
        }
      }
    }

    return policies;
  }

  private async getPasswordPolicy(): Promise<PasswordPolicy> {
    try {
      const response = await this.iamClient.send(
        new GetAccountPasswordPolicyCommand({}),
      );

      if (response.PasswordPolicy) {
        const policy = response.PasswordPolicy;
        return {
          allowUsersToChangePassword: policy.AllowUsersToChangePassword,
          minimumPasswordLength: policy.MinimumPasswordLength,
          requireSymbols: policy.RequireSymbols,
          requireUpperCase: policy.RequireUppercaseCharacters,
          requireLowerCase: policy.RequireLowercaseCharacters,
          requireNumbers: policy.RequireNumbers,
          expirePassword: policy.ExpirePasswords,
          maxPasswordAge: policy.MaxPasswordAge,
          passwordReusePrevention: policy.PasswordReusePrevention,
          hardExpiry: policy.HardExpiry,
        };
      }
      return {};
    } catch (error: any) {
      if (error.name === "NoSuchEntityException") return {};
      console.error(
        "[IAMCollector] Error fetching password policy:",
        error.message,
      );
      return {};
    }
  }

  private async getAccountData(): Promise<IAMAccountSummary> {
    try {
      const response: GetAccountSummaryCommandOutput =
        await this.iamClient.send(new GetAccountSummaryCommand({}));

      const summary = response.SummaryMap ?? {};

      return {
        users: summary["Users"],
        usersQuota: summary["UsersQuota"],
        groups: summary["Groups"],
        groupsQuota: summary["GroupsQuota"],
        roles: summary["Roles"],
        rolesQuota: summary["RolesQuota"],
        instanceProfiles: summary["InstanceProfiles"],
        accountMFAEnabled: summary["AccountMFAEnabled"] === 1,
        accountAccessKeysPresent: summary["AccountAccessKeysPresent"] === 1,
      };
    } catch (error: any) {
      console.error(
        "[IAMCollector] Error fetching account summary:",
        error.message,
      );
      return {};
    }
  }

  protected async fetchRaw(context: CollectorContext): Promise<IAMData[]> {
    const iamDate: IAMData = {
      users: await this.getIAMUser(),
      roles: await this.getIAMRoles(),
      groups: await this.getIAMGroups(),
      policies: await this.getPolicies(),
      passwordPolicy: await this.getPasswordPolicy(),
      accountSummary: await this.getAccountData(),
    };

    return [iamDate];
  }
  protected classifyError(err: unknown): CollectorError {
    throw new Error("Method not implemented.");
  }
}
