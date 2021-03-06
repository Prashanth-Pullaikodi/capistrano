# Capistrano::Docker::Vagrant

Continuous deployment  using Jenkins Pipeline , Capistrano ,Vagrant and Docker .

For detailed documentation refer my blog [https://devops-geek.blogspot.com](https://devops-geek.blogspot.com/2018/12/continuous-deployment-jenkins.html)

# How it works!!!!

Capistrano is a framework for building automated deployment scripts on remote node.Here your VirtualBox will be a remote node.
Capistrano will push your code into vagrant box when you run cap commands,which will build Docker image ,Push to registry and deploy the NGINX we b application (which is accessible http://localhost:8081 )


# Pre-Requitse:

  - [Ruby](https://www.ruby-lang.org/en/)      : Install and configure Ruby.
  - [Capistrano](https://capistranorb.com/)    : Install and configure capistrano .
  - [Vagrant](https://www.vagrantup.com/)      : Install and configure vagrant.
  - [VirtualBox](https://www.virtualbox.org/)  :Install and confgiure VirtualBox.
  - [Docker](https://www.docker.com/)          :Install and confgure docker on Vagrant box.

Once you installed Vagrant and VirtualBox you can clone repo [https://github.com/Prashanth-Pullaikodi/vagrant_docker_ansible] to your local machine and run Vagrant Up will create a Virtualbox with Docker installed.

 ```bash
    cd vagrant_docker_ansible
    vagrant up
    Vagrant status
    vagrant ssh
```

Clone this repo [https://github.com/Prashanth-Pullaikodi/capistrano] to your local node.
  ```bash   
 git clone git@github.com:Prashanth-Pullaikodi/capistrano.git
 cd capistrano
```

Run (vagrant ssh-config)  , Find out your vagrant Port and Key path  and modify below values.

Port:  and   Keys:

 ```bash
vi config/deploy/vagrantbox.rb

set :ssh_options, {
       user: 'vagrant', # overrides user setting above
       port: '2222',
       keys: "~/.vagrant.d/insecure_private_key",
       forward_agent: 'yes',
       password: 'please use keys',
      }
   ```

Create your onw dockerHUB account and change below vsalues to your account.
Or if you have your local repo replace "remote_repo --> local_repo" in config/deploy.rb .

```bash
vi config/deploy.rb
set :remote_repo, "your_docker_hub_account_name/#{fetch(:application)}"
 ```

## Deployment:

Note: Before running deployment,make sure that you login to your dockerHUB repo on both local and vgarant node.

```bash
docker login
Login with your Docker ID to push and pull images from Docker Hub. If you don't have a Docker ID, head over to https://hub.docker.com to create one.
Username (xxxx):
```

if you have Jenkins installed and configured ,Use  pipile line file 'Jenkinsfile' to  build and deploy the app or create a free style job and copy the config.xml to Jenkins job directory.

Note - Make sure you installed (Jenkins Git and Pipiline plugins)
```bash
cd capistrano
cp  config.xml /Users/username/.jenkins/jobs/jenkins_job_name/config.xml
```
And restart your jenkins service to make effect the change.

## OR Follow below manual step to deploy the app.

Go to your Capistrano directory.

Note: If you want to build your own nginx docker image ,make sure you have docker running on your local meachine as well.


```bash
cd capistrano
bundle exec cap vagrantbox  build  # This will build your nginx docker image.
bundle exec cap vagrantbox push    # This will push your nginx docker image to your repo.
bundle exec cap vagrantbox deploy  # This will deploy your Nginx app in your vagrant box.
bundle exec cap vagrantbox -T      #List all the capistrano commands.
```
