
node {
    stage "Create build output"
    
    
    dir('capistrano') {
        sh "source ~/.bashrc"
        sh  "bundle exec cap vagrantbox build"
    }
   
}
