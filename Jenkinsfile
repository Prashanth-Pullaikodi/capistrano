pipeline {
    agent any
    checkout scm 
    stages {
        stage ('Build Image') {

        withEnv([
         "PATH=$HOME/.rbenv/bin:$HOME/.rbenv/shims:$PATH",
         
        ]){
            dir('config') {
                       workspace = pwd ()
            
                      sh 'bundle exec cap vagrantbox docker:build_image'
                      } 
                }
        
        }

        stage ('Push Image') {

        withEnv([
         "PATH=$HOME/.rbenv/bin:$HOME/.rbenv/shims:$PATH",
         
        ]){
            dir('config') {
                       workspace = pwd ()
            
                      sh 'bundle exec cap vagrantbox docker:build_image'
                      } 
                }
        }

        stage ('Deployment Stage') {
          sh 'cap vagrantbox deploy'
        }
    }
}
