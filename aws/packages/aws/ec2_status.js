/**
 * A small function that converts slack elements `context` and `section` to mattermost compatible markdown.
 * @param {object} element - Slack element
 * @param {string} client - name of the client
 */
const mui = (element, client) => {
  const output = [];
  if (client === 'slack') {
    return element;
  } else {
    if (element.type === 'context') {
      for (const item of element.elements) {
        output.push(item.text.replace(/\*/g, '**'));
      }
    } else if (element.type === 'section') {
      output.push(element.text.text.replace(/\*/g, '**'));
    }
  }

  return output.join(' ');
};

/**
 * @description undefined
 * @param {ParamsType} params list of command parameters
 * @param {?string} commandText text message
 * @param {!object} [secrets = {}] list of secrets
 * @return {Promise<SlackBodyType>} Response body
 */
async function _command(params, commandText, secrets = {}) {
  const {awsAccessKey, awsSecretKey, awsRegion} = secrets;

  if (!awsAccessKey || !awsSecretKey || !awsRegion) {
    return {
      response_type: 'ephemeral',
      text:
        'You need `awsAccessKey`, `awsSecretKey` and `awsRegion` secrets to use this command. Create one by running `/nc secret_create`.'
    };
  }

  const {id: instanceId, __client} = params;

  const client = __client.name;

  const result = [];
  const aws = require('aws-sdk');
  const ec2 = new aws.EC2({
    apiVersion: '2016-11-15',
    accessKeyId: awsAccessKey,
    secretAccessKey: awsSecretKey,
    region: awsRegion
  });

  try {
    const {promisify} = require('util');
    const describeInstanceStatusAsync = promisify(
      ec2.describeInstanceStatus
    ).bind(ec2);

    const {InstanceStatuses} = await describeInstanceStatusAsync({
      DryRun: false,
      InstanceIds: [instanceId]
    });

    for (const instance of InstanceStatuses) {
      result.push(
        mui(
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `ID: \`${instance.InstanceId}\``
              },
              {
                type: 'mrkdwn',
                text: `State: \`${instance.InstanceState.Name}\``
              },
              {
                type: 'mrkdwn',
                text: `InstanceStatus: \`${instance.InstanceStatus.Status}\``
              },
              {
                type: 'mrkdwn',
                text: `SystemStatus: \`${instance.SystemStatus.Status}\``
              }
            ]
          },
          client
        )
      );
    }
  } catch (error) {
    result.push(
      mui(
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*ERROR:* ${error.message}`
          }
        },
        client
      )
    );
  }

  return {
    response_type: 'in_channel',
    [client === 'slack' ? 'blocks' : 'text']:
      client === 'slack' ? result : result.join('\n')
  };
}

/**
 * @typedef {object} SlackBodyType
 * @property {string} text
 * @property {'in_channel'|'ephemeral'} [response_type]
 */

const main = async (args) => ({
  body: await _command(args.params, args.commandText, args.__secrets || {}).catch(error => ({
    response_type: 'ephemeral',
    text: `Error: ${error.message}`
  }))
});
module.exports = main;
