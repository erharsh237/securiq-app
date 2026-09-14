import {
  EC2Client,
  DescribeInstancesCommand,
  type DescribeInstancesCommandOutput,
  DescribeSecurityGroupsCommand,
  type DescribeSecurityGroupsCommandOutput,
  DescribeVolumesCommand,
  type DescribeVolumesCommandOutput,
  EC2ClientConfig,
} from "@aws-sdk/client-ec2";
import { BaseCollector } from "../config/baseCollector";
import { awsClientConfig } from "../config/awsClient";
import {
  BaseRawData,
  CollectorContext,
  CollectorError,
  CollectorResult,
  Provider,
  Tags,
} from "../config/types";

interface SecurityGroupRules {
  ruleID: string;
  direction: "ingress" | "egress";
  protocol: string;
  fromPort?: number;
  toPort?: number;
  ipv4cidr?: string;
  ipv6cidr?: string;
}

interface SecurityGroup {
  externalID: string;
  name?: string;
  vpcId?: string;
  ownerId?: string;
  rules?: Array<SecurityGroupRules>;
  desc?: string;
}

interface EBSAttachment {
  instanceId: string;
  deleteOnTermination: boolean;
}

interface EBSVolume {
  volumeID: string;
  volumeType: "standard" | "io1" | "io2" | "gp2" | "sc1" | "st1" | "gp3";
  encrypted: boolean;
  attachments: EBSAttachment[];
  size?: number;
  createdTime?: Date;
  snapshotId?: string;
  kmsKeyId?: string;
  status:
    | "creating"
    | "available"
    | "in-use"
    | "deleting"
    | "deleted"
    | "error";
}

interface EC2RawData extends BaseRawData {
  instanceId: string;
  instanceName: string;
  instanceType: string;
  state: { name?: string };
  availabilityZone?: string;
  publicIP?: string;
  privateIP?: string;
  iamInstanceProfile?: {
    arn?: string;
    id?: string;
  };
  keyName?: string;
  launchTime?: Date;
  tags?: Tags[];
  vpcId?: string;
  subnetId?: string;
  monitoring: { state: "disabled" | "disabling" | "enabled" | "pending" };
  amiId?: string;
  imdsv2Required: boolean;
  securityGroups?: SecurityGroup[];
  ebsVolumes?: EBSVolume[];
}

export class EC2Collector extends BaseCollector<EC2RawData> {
  id: string = "ec2Collector";
  provider: Provider = "aws" as const;
  private ec2Client: EC2Client;

  constructor(region: string = "us-east-1") {
    super();
    this.ec2Client = new EC2Client(awsClientConfig<EC2ClientConfig>(region));
  }

  private async SecurityGroupsCollector(): Promise<Map<string, SecurityGroup>> {
    const securityGroupsMap = new Map<string, SecurityGroup>();
    const response: DescribeSecurityGroupsCommandOutput =
      await this.ec2Client.send(new DescribeSecurityGroupsCommand({}));

    if (response.SecurityGroups && response.SecurityGroups.length > 0) {
      for (const group of response.SecurityGroups) {
        const rules: SecurityGroupRules[] = [];

        group.IpPermissions?.forEach((rule, idx) => {
          rule.IpRanges?.forEach((ip) => {
            rules.push({
              ruleID: `${group.GroupId}-ingress-v4-${idx}`,
              direction: "ingress",
              protocol: rule.IpProtocol ?? "all",
              fromPort: rule.FromPort,
              toPort: rule.ToPort,
              ipv4cidr: ip.CidrIp,
            });
          });

          rule.Ipv6Ranges?.forEach((ip) => {
            rules.push({
              ruleID: `${group.GroupId}-ingress-v6-${idx}`,
              direction: "ingress",
              protocol: rule.IpProtocol ?? "all",
              fromPort: rule.FromPort,
              toPort: rule.ToPort,
              ipv4cidr: ip.CidrIpv6,
            });
          });
        });

        group.IpPermissionsEgress?.forEach((rule, idx) => {
          rule.IpRanges?.forEach((ip) => {
            rules.push({
              ruleID: `${group.GroupId}-egress-${idx}`,
              direction: "egress",
              protocol: rule.IpProtocol ?? "all",
              fromPort: rule.FromPort,
              toPort: rule.ToPort,
              ipv4cidr: ip.CidrIp,
            });
          });

          rule.Ipv6Ranges?.forEach((ip) => {
            rules.push({
              ruleID: `${group.GroupId}-egress-v6-${idx}`,
              direction: "egress",
              protocol: rule.IpProtocol ?? "all",
              fromPort: rule.FromPort,
              toPort: rule.ToPort,
              ipv4cidr: ip.CidrIpv6,
            });
          });
        });

        const scGroupModel: SecurityGroup = {
          externalID: group.GroupId ?? "",
          name: group.GroupName,
          vpcId: group.VpcId,
          ownerId: group.OwnerId,
          rules: rules,
          desc: group.Description,
        };

        if (group.GroupId) {
          securityGroupsMap.set(group.GroupId, scGroupModel);
        }
      }
    }

    return securityGroupsMap;
  }

  private async EBSVolumeCollector(): Promise<EBSVolume[]> {
    const ebsVolumes: EBSVolume[] = [];
    const response: DescribeVolumesCommandOutput = await this.ec2Client.send(
      new DescribeVolumesCommand({}),
    );

    if (response.Volumes) {
      response.Volumes.forEach((volume) => {
        const attachments: EBSAttachment[] = (volume.Attachments || []).map(
          (attachment) => ({
            instanceId: attachment.InstanceId ?? "",
            deleteOnTermination: attachment.DeleteOnTermination ?? false,
          }),
        );
        ebsVolumes.push({
          volumeID: volume.VolumeId ?? "",
          volumeType: (volume.VolumeType as EBSVolume["volumeType"]) ?? "gp3",
          encrypted: volume.Encrypted ?? false,
          attachments: attachments,
          status: (volume.State as EBSVolume["status"]) ?? "available",
          size: volume.Size,
          createdTime: volume.CreateTime,
          snapshotId: volume.SnapshotId,
          kmsKeyId: volume.KmsKeyId,
        });
      });
    }

    // console.log(JSON.stringify(ebsVolumes, null, 2))
    return ebsVolumes;
  }

  protected async fetchRaw(ctx: CollectorContext): Promise<EC2RawData[]> {
    const instances: EC2RawData[] = [];
    const securityGroups: Map<string, SecurityGroup> =
      await this.SecurityGroupsCollector();
    const ebsVolumes: EBSVolume[] = await this.EBSVolumeCollector();

    const response: DescribeInstancesCommandOutput = await this.ec2Client.send(
      new DescribeInstancesCommand({}),
    );
    if (response.Reservations && response.Reservations.length > 0) {
      for (const reservation of response.Reservations) {
        if (!reservation.Instances) continue;

        for (const instance of reservation.Instances) {
          if (!instance.InstanceId) continue;

          const instanceName =
            instance.Tags?.find((tag) => tag.Key === "Name")?.Value ??
            instance.InstanceId;

          const instanceSecurityGroups: SecurityGroup[] = [];
          instance.SecurityGroups?.forEach((sg) => {
            if (sg.GroupId && securityGroups.has(sg.GroupId)) {
              instanceSecurityGroups.push(securityGroups.get(sg.GroupId)!);
            }
          });

          const instanceVolumes = ebsVolumes.filter((vol) => {
            return vol.attachments.some(
              (att) => att.instanceId === instance.InstanceId,
            );
          });

          const instanceTags: { key?: string; value?: string }[] = [];
          instance.Tags?.forEach((tag) => {
            instanceTags.push({ key: tag.Key, value: tag.Value });
          });

          instances.push({
            instanceId: instance.InstanceId,
            instanceName: instanceName,
            instanceType: instance.InstanceType ?? "unknown",
            state: {
              name: instance.State?.Name,
            },
            availabilityZone: instance.Placement?.AvailabilityZone,
            publicIP: instance.PublicIpAddress,
            privateIP: instance.PrivateIpAddress,

            imdsv2Required: instance.MetadataOptions?.HttpTokens === "required",
            securityGroups: instanceSecurityGroups,
            ebsVolumes: instanceVolumes,
            iamInstanceProfile: instance.IamInstanceProfile
              ? {
                  arn: instance.IamInstanceProfile.Arn,
                  id: instance.IamInstanceProfile.Id,
                }
              : undefined,
            keyName: instance.KeyName,
            launchTime: instance.LaunchTime,
            tags: instanceTags,
            vpcId: instance.VpcId,
            subnetId: instance.SubnetId,
            monitoring: {
              state:
                (instance.Monitoring
                  ?.State as EC2RawData["monitoring"]["state"]) ?? "disabled",
            },
            amiId: instance.ImageId,
          });
        }
      }
    }
    return instances;
  }

  protected classifyError(err: unknown): CollectorError {
    throw new Error("Method not implemented.");
  }
}
