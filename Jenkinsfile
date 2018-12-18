pipeline {
    agent any

    stages {
        stage ('Build Image') {
                 
            steps {
                withEnv(["PATH=$HOME/.rbenv/bin:$HOME/.rbenv/shims:$PATH"]){      
                     dir('config') {
                             sh 'cap vagrantbox docker:build_image'
                         }
                }
            }
       }
        
        stage ('Push Image') {

            steps {
               withEnv(["PATH=$HOME/.rbenv/bin:$HOME/.rbenv/shims:$PATH"]){ 
                    dir('config') {
                            sh 'cap vagrantbox docker:push_image'
                   }
               }
            }
        }


        stage ('Deployment Stage') {
            steps {
 
                    sh 'cap vagrantbox deploy'

            }
        }
    }
}
